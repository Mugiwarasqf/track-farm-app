import type { ScheduledHandler } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, queryAll, scanAll, tables } from "../../lib/dynamo";
import { logger } from "../../lib/logger";
import { computeFeedStock } from "../../lib/feedStock";
import { type FeedAlertLine, type WithdrawalEnded, feedStockPush, withdrawalEndedPush } from "../../lib/emailTemplates";
import { sendPushToFarm } from "../../lib/push";
import { isIsoDay } from "../../lib/dates";

// Daily 7am (infra/modules/notifications/). Phone push only, no email:
//   - feed stock low/out (Settings "Feed stock alerts")
//   - withdrawal period over (Settings "Medications & withdrawal periods")
// The app shows the same alerts in-app (frontend lib/notifications/source.js).

// Re-push a feed line still low/out after this many days; sooner if it gets worse.
const FEED_REPUSH_DAYS = 3;
const MAX_COURSE_DAYS = 30;

type PushedState = Record<string, { status: string; date: string }>;

function byBatch(table: string, batchId: string) {
  return queryAll({
    TableName: table,
    KeyConditionExpression: "batchId = :b",
    ExpressionAttributeValues: { ":b": batchId },
  });
}

function addDays(isoDay: string, n: number): string {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** Same rule as SupplementModal: day after the last course day plus withdrawal days. */
export function withdrawalSafeDate(s: Record<string, any>): string | null {
  const wd = Number(s.withdrawalDays);
  if (!(wd > 0) || !isIsoDay(s.date)) return null;
  const course = Math.min(Math.max(Number(s.durationDays) || 1, 1), MAX_COURSE_DAYS);
  return addDays(addDays(s.date, course - 1), wd + 1);
}

async function feedAlerts(farm: Record<string, any>, batches: Record<string, any>[], today: string) {
  const purchases = await queryAll({
    TableName: tables.feedPurchases,
    KeyConditionExpression: "farmId = :f",
    ExpressionAttributeValues: { ":f": farm.farmId },
  });
  if (purchases.length === 0) return 0;

  // All batches, closed ones too: their usage still came out of the store.
  const usage = (await Promise.all(batches.map((b) => byBatch(tables.feedLogs, b.batchId)))).flat();
  const lines = computeFeedStock(purchases, usage, today);

  const prev: PushedState = farm.feedAlertsPushed ?? {};
  const next: PushedState = {};
  const toPush: FeedAlertLine[] = [];
  const repushBefore = addDays(today, -FEED_REPUSH_DAYS);

  for (const line of lines) {
    if (line.status === "ok") continue;
    const last = prev[line.key];
    const worse = last?.status === "low" && line.status === "out";
    if (!last || worse || last.date <= repushBefore) {
      toPush.push({ label: line.label, left: line.left, daysLeft: line.daysLeft, status: line.status });
      next[line.key] = { status: line.status, date: today };
    } else {
      next[line.key] = last;
    }
  }

  // Lines back to ok drop out of the state, so the next dip pushes straight away.
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    await ddb.send(
      new UpdateCommand({
        TableName: tables.farms,
        Key: { farmId: farm.farmId },
        UpdateExpression: "SET feedAlertsPushed = :s",
        ExpressionAttributeValues: { ":s": next },
      })
    );
  }

  if (toPush.length === 0) return 0;
  return sendPushToFarm(farm.farmId, feedStockPush(toPush));
}

async function withdrawalAlerts(farm: Record<string, any>, active: Record<string, any>[], today: string) {
  const ended: WithdrawalEnded[] = [];
  for (const batch of active) {
    for (const s of await byBatch(tables.supplements, batch.batchId)) {
      if (withdrawalSafeDate(s) !== today) continue;
      ended.push({
        batchId: batch.batchId,
        batchName: String(batch.name || "Your batch"),
        product: String(s.product || "the treatment"),
      });
    }
  }
  if (ended.length === 0) return 0;
  return sendPushToFarm(farm.farmId, withdrawalEndedPush(ended));
}

export const handler: ScheduledHandler = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const farms = await scanAll({ TableName: tables.farms });

  let feedPushed = 0;
  let withdrawalPushed = 0;
  let failed = 0;

  for (const farm of farms) {
    const prefs = farm.notificationPrefs ?? {};
    if (prefs.feedAlerts === false && prefs.medicationAlerts === false) continue;

    try {
      const batches = await queryAll({
        TableName: tables.batches,
        KeyConditionExpression: "farmId = :f",
        ExpressionAttributeValues: { ":f": farm.farmId },
      });
      if (prefs.feedAlerts !== false) feedPushed += await feedAlerts(farm, batches, today);
      if (prefs.medicationAlerts !== false) {
        const active = batches.filter((b) => b.status === "active");
        withdrawalPushed += await withdrawalAlerts(farm, active, today);
      }
    } catch (err: any) {
      // One farm's bad data mustn't stop everyone else's alerts.
      failed++;
      logger.warn("farm_alerts_failed", { farmId: farm.farmId, message: err?.message });
    }
  }

  logger.info("farm_alerts_run_complete", {
    farmsScanned: farms.length,
    feedPushed,
    withdrawalPushed,
    failed,
  });
};
