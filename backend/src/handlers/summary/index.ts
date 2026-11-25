import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { queryAll, tables } from "../../lib/dynamo";
import { farmIdFromEvent, ok } from "../../lib/http";
import { stockKey } from "../../lib/feedStock";
import { feedPurchaseCost, feedUsageCost, medicinePurchaseCost, recordCost } from "../../lib/expenses";

// GET /farms/{id}/summary?period=week|month: the profit & expense summary.
// Money out counts when spent: store purchases on the day bought, things
// bought straight for a batch when recorded (lib/expenses.ts).
// (docs/04-v1-feature-scope.md §5). Computed fresh from the records on every
// call, so it's a running total (Elizabeth's ask), never a month-end figure.
// "week" = last 7 days, "month" = last 30, both including today. Month is
// also split into 7-day buckets so a farmer sees each week roll into it.
//
// farmId comes from the caller's token, never the {id} in the path.

const EGGS_PER_CRATE = 30;

interface Totals {
  feedCostNaira: number;
  vaccineCostNaira: number;
  supplementCostNaira: number;
  birdCostNaira: number;
  eggRevenueNaira: number;
  birdSalesNaira: number;
}

const emptyTotals = (): Totals => ({
  feedCostNaira: 0,
  vaccineCostNaira: 0,
  supplementCostNaira: 0,
  birdCostNaira: 0,
  eggRevenueNaira: 0,
  birdSalesNaira: 0,
});

const costOf = (t: Totals) => t.feedCostNaira + t.vaccineCostNaira + t.supplementCostNaira + t.birdCostNaira;
const incomeOf = (t: Totals) => t.eggRevenueNaira + t.birdSalesNaira;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

function isoDay(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().slice(0, 10);
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const farmId = farmIdFromEvent(event);

  const period = event.queryStringParameters?.period === "month" ? "month" : "week";
  const days = period === "month" ? 30 : 7;
  const endDate = isoDay(0);
  const startDate = isoDay((days - 1) * 86400000);
  const inWindow = (d: unknown) => typeof d === "string" && d >= startDate && d <= endDate;

  // 7-day buckets counted back from today; the oldest may be shorter.
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
    const end = isoDay(i * 7 * 86400000);
    const start = isoDay(Math.min(i * 7 + 6, days - 1) * 86400000);
    return { startDate: start, endDate: end, totals: emptyTotals() };
  });
  const bucket = (d: string) => weeks.find((w) => d >= w.startDate && d <= w.endDate);

  const total = emptyTotals();
  const add = (date: unknown, key: keyof Totals, amount: number) => {
    if (!inWindow(date) || !amount) return;
    total[key] += amount;
    const w = bucket(date as string);
    if (w) w.totals[key] += amount;
  };

  const batches = await queryAll({
    TableName: tables.batches,
    KeyConditionExpression: "farmId = :farmId",
    ExpressionAttributeValues: { ":farmId": farmId },
  });

  let birdsLost = 0;
  let eggsCollected = 0;

  for (const batch of batches) {
    // Birds bought count on the batch's start date. salesRevenueNaira is
    // from before /sales existed (set at completion); new sales are below.
    add(batch.startDate, "birdCostNaira", num(batch.purchaseCostNaira));
    if (typeof batch.closedAt === "string") add(batch.closedAt.slice(0, 10), "birdSalesNaira", num(batch.salesRevenueNaira));
  }

  // Store purchases count as money out on the day bought (lib/expenses.ts).
  const [feedPurchases, medicinePurchases] = await Promise.all([
    queryAll({
      TableName: tables.feedPurchases,
      KeyConditionExpression: "farmId = :f",
      ExpressionAttributeValues: { ":f": farmId },
    }),
    queryAll({
      TableName: tables.medicinePurchases,
      KeyConditionExpression: "farmId = :f",
      FilterExpression: "#d BETWEEN :s AND :e",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":f": farmId, ":s": startDate, ":e": endDate },
    }),
  ]);
  // All feed ever bought, so usage from any of it is recognised as already paid for.
  const feedStoreKeys = new Set(feedPurchases.map((p) => stockKey(p)));
  for (const p of feedPurchases) add(p.date, "feedCostNaira", feedPurchaseCost(p));
  for (const p of medicinePurchases) {
    add(p.date, p.kind === "vaccine" ? "vaccineCostNaira" : "supplementCostNaira", medicinePurchaseCost(p));
  }

  const sales = await queryAll({
    TableName: tables.sales,
    KeyConditionExpression: "farmId = :f",
    FilterExpression: "#d BETWEEN :s AND :e",
    ExpressionAttributeNames: { "#d": "date" },
    ExpressionAttributeValues: { ":f": farmId, ":s": startDate, ":e": endDate },
  });
  for (const s of sales) {
    add(s.date, s.product === "birds" ? "birdSalesNaira" : "eggRevenueNaira", num(s.amountNaira));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const byBatch = (table: string, dateField = "date") =>
        queryAll({
          TableName: table,
          KeyConditionExpression: "batchId = :b",
          FilterExpression: "#d BETWEEN :s AND :e",
          ExpressionAttributeNames: { "#d": dateField },
          ExpressionAttributeValues: { ":b": batch.batchId, ":s": startDate, ":e": endDate },
        });

      const [feed, eggs, vaccinations, supplements, mortality] = await Promise.all([
        byBatch(tables.feedLogs),
        byBatch(tables.eggLogs),
        byBatch(tables.vaccinationRecords, "dateAdministered"),
        byBatch(tables.supplements),
        byBatch(tables.mortalityLogs),
      ]);

      for (const f of feed) add(f.date, "feedCostNaira", feedUsageCost(f, feedStoreKeys));
      for (const e of eggs) {
        add(e.date, "eggRevenueNaira", num(e.revenueNaira));
        eggsCollected += num(e.crates) * EGGS_PER_CRATE + num(e.looseEggs);
      }
      for (const v of vaccinations) add(v.dateAdministered, "vaccineCostNaira", recordCost(v));
      for (const s of supplements) add(s.date, "supplementCostNaira", recordCost(s));
      for (const m of mortality) birdsLost += num(m.count);
    })
  );

  return ok({
    farmId,
    period,
    startDate,
    endDate,
    ...total,
    // Kept for older app builds: vaccines + vitamins/dewormers.
    drugCostNaira: total.vaccineCostNaira + total.supplementCostNaira,
    totalCostNaira: costOf(total),
    totalIncomeNaira: incomeOf(total),
    netNaira: incomeOf(total) - costOf(total),
    birdsLost,
    eggsCollected,
    weeks: weeks
      .map((w) => ({
        startDate: w.startDate,
        endDate: w.endDate,
        costNaira: costOf(w.totals),
        incomeNaira: incomeOf(w.totals),
        netNaira: incomeOf(w.totals) - costOf(w.totals),
      }))
      .reverse(),
  });
}
