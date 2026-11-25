import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFeedStock, stockKey } from "../src/lib/feedStock";
import { checkRecordDate, isIsoDay } from "../src/lib/dates";
import { pickOptional } from "../src/lib/optionalFields";
import { withdrawalSafeDate } from "../src/handlers/scheduled/farmAlerts";
import { feedStockPush, withdrawalEndedPush } from "../src/lib/emailTemplates";

const TODAY = "2026-11-24";
const daysAgo = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

test("stockKey ignores case and spacing, defaults bag size", () => {
  assert.equal(stockKey({ feedType: " Layer Mash ", brand: "CHIKUN" }), "layer mash|chikun|25");
});

test("feed stock: ok, low and out", () => {
  const purchases = [
    { feedType: "Layer mash", brand: "Chikun", bagSizeKg: 25, bags: 10 },
    { feedType: "Grower mash", brand: "", bagSizeKg: 25, bags: 5 },
    { feedType: "Broiler starter", brand: "", bagSizeKg: 25, bags: 40 },
  ];
  const usage = [
    { feedType: "layer mash", brand: "chikun", bagSizeKg: 25, bags: 7, date: daysAgo(2) },
    { feedType: "Grower mash", brand: "", bagSizeKg: 25, amountKg: 125, date: daysAgo(3) },
    { feedType: "Broiler starter", brand: "", bagSizeKg: 25, bags: 1, date: daysAgo(1) },
    { feedType: "Never bought", bags: 3, date: daysAgo(1) },
  ];
  const lines = Object.fromEntries(computeFeedStock(purchases, usage, TODAY).map((l) => [l.label, l]));
  assert.equal(lines["Layer mash · Chikun"].status, "low");
  assert.equal(lines["Layer mash · Chikun"].left, 3);
  assert.equal(lines["Grower mash"].status, "out");
  assert.equal(lines["Broiler starter"].status, "ok");
  assert.equal(Object.keys(lines).length, 3, "unmatched usage is ignored");
});

test("feed stock: usage older than a week doesn't count toward daily rate", () => {
  const [line] = computeFeedStock(
    [{ feedType: "Layer mash", bags: 20 }],
    [{ feedType: "Layer mash", bags: 10, date: daysAgo(10) }],
    TODAY
  );
  assert.equal(line.left, 10);
  assert.equal(line.daysLeft, null);
  assert.equal(line.status, "ok");
});

test("withdrawal safe date matches the supplement form", () => {
  assert.equal(withdrawalSafeDate({ date: "2026-11-20", durationDays: 3, withdrawalDays: 7 }), "2026-11-30");
  assert.equal(withdrawalSafeDate({ date: "2026-11-20", withdrawalDays: 1 }), "2026-11-22");
  assert.equal(withdrawalSafeDate({ date: "2026-11-20", durationDays: 99, withdrawalDays: 1 }), "2026-12-21", "course capped at 30 days");
  assert.equal(withdrawalSafeDate({ date: "2026-11-20", withdrawalDays: 0 }), null);
  assert.equal(withdrawalSafeDate({ date: "not a date", withdrawalDays: 3 }), null);
});

test("record dates: format, future and the one-day UTC slack", () => {
  assert.equal(isIsoDay("2026-02-30"), true, "Date.parse rolls over; format is what's checked");
  assert.equal(isIsoDay("24/11/2026"), false);
  assert.match(checkRecordDate("2026/11/24") ?? "", /YYYY-MM-DD/);
  assert.equal(checkRecordDate(new Date().toISOString().slice(0, 10)), null);
  assert.match(checkRecordDate("2999-01-01") ?? "", /future/);
});

test("pickOptional keeps only typed, non-empty, non-negative values", () => {
  const out = pickOptional(
    { a: " hi ", b: "", c: 5, d: -1, e: "5", f: { x: 1 } },
    { a: "string", b: "string", c: "number", d: "number", e: "number", f: "string" }
  );
  assert.deepEqual(out, { a: "hi", c: 5 });
});

test("feed push puts out-of-stock first and counts the rest", () => {
  const msg = feedStockPush([
    { label: "Grower mash", left: 1.5, daysLeft: 2, status: "low" },
    { label: "Layer mash", left: 0, daysLeft: null, status: "out" },
  ]);
  assert.equal(msg.title, "Out of Layer mash");
  assert.match(msg.body, /1 more feed low/);
  assert.equal(msg.tag, "feed-stock");
});

test("withdrawal push links to the batch when there's one", () => {
  const one = withdrawalEndedPush([{ batchId: "b1", batchName: "Pen A", product: "Piperazine" }]);
  assert.equal(one.url, "/batches/b1");
  const two = withdrawalEndedPush([
    { batchId: "b1", batchName: "Pen A", product: "X" },
    { batchId: "b2", batchName: "Pen B", product: "Y" },
  ]);
  assert.equal(two.url, "/batches");
  assert.match(two.body, /Pen A, Pen B/);
});

import { validateSale } from "../src/handlers/sales/index";
import { flockCount } from "../src/lib/flock";

const today = new Date().toISOString().slice(0, 10);

test("sale validation: birds need a batch or a type, and whole numbers", () => {
  const birds = { date: today, product: "birds", batchId: "b1", quantity: 10, pricePerUnitNaira: 7000 };
  assert.equal(validateSale(birds), null);
  assert.equal(validateSale({ ...birds, batchId: undefined, birdType: "turkey" }), null);
  assert.match(validateSale({ ...birds, batchId: undefined }) ?? "", /batchId or birdType/);
  assert.match(validateSale({ ...birds, quantity: 2.5 }) ?? "", /whole number/);
  assert.match(validateSale({ ...birds, quantity: 0 }) ?? "", /above zero/);
});

test("sale validation: eggs need a size and unit, any sale needs a price", () => {
  const eggs = { date: today, product: "eggs", eggSize: "large", unit: "crates", quantity: 3, pricePerUnitNaira: 4500 };
  assert.equal(validateSale(eggs), null);
  assert.match(validateSale({ ...eggs, eggSize: "huge" }) ?? "", /eggSize/);
  assert.match(validateSale({ ...eggs, unit: "trays" }) ?? "", /unit/);
  assert.match(validateSale({ ...eggs, pricePerUnitNaira: undefined }) ?? "", /price/);
  assert.equal(validateSale({ ...eggs, pricePerUnitNaira: undefined, amountNaira: 0 }), null);
  assert.match(validateSale({ ...eggs, product: "feed" }) ?? "", /product/);
  assert.match(validateSale({ ...eggs, date: "2999-01-01" }) ?? "", /future/);
});

test("birds alive = placed - deaths - sold, never below zero", () => {
  assert.deepEqual(flockCount(500, 12, 100), { birdsLost: 12, birdsSoldToDate: 100, currentBirds: 388 });
  assert.equal(flockCount(10, 8, 5).currentBirds, 0);
  assert.equal(flockCount(undefined, 0, 0).currentBirds, 0);
});

import { computeEggStock } from "../src/lib/eggStock";

test("eggs in store: collected minus sold, farm-wide and per batch", () => {
  const stock = computeEggStock(
    {
      b1: [{ crates: 10, looseEggs: 5 }, { crates: 2 }],
      b2: [{ looseEggs: 40 }],
      b3: [],
    },
    [
      { product: "eggs", unit: "crates", quantity: 3, batchId: "b1" },
      { product: "eggs", unit: "pieces", quantity: 10 },
      { product: "birds", quantity: 50, batchId: "b1" },
    ]
  );
  assert.equal(stock.eggsLeft, 365 + 40 - 90 - 10);
  assert.deepEqual(stock.byBatch, { b1: 365 - 90, b2: 40 });
});

test("eggs in store never goes below zero", () => {
  const stock = computeEggStock({ b1: [{ crates: 1 }] }, [{ product: "eggs", unit: "crates", quantity: 5, batchId: "b1" }]);
  assert.deepEqual(stock, { eggsLeft: 0, byBatch: { b1: 0 } });
});

import { validatePurchase } from "../src/handlers/medicineStock/index";

test("medicine purchase: vaccines need doses per vial, quantities are whole", () => {
  const vaccine = { date: today, kind: "vaccine", name: "Lasota", quantity: 4, dosesPerVial: 1000, pricePerUnitNaira: 2500 };
  assert.equal(validatePurchase(vaccine), null);
  assert.match(validatePurchase({ ...vaccine, dosesPerVial: undefined }) ?? "", /dosesPerVial/);
  assert.match(validatePurchase({ ...vaccine, quantity: 1.5 }) ?? "", /whole number/);
  assert.match(validatePurchase({ ...vaccine, expiry: "next year" }) ?? "", /expiry/);
  const vitamin = { date: today, kind: "supplement", name: "Vitalyte", quantity: 10, packSize: "100g" };
  assert.equal(validatePurchase(vitamin), null);
  assert.match(validatePurchase({ ...vitamin, name: " " }) ?? "", /name/);
  assert.match(validatePurchase({ ...vitamin, kind: "feed" }) ?? "", /kind/);
});

import { feedPurchaseCost, feedUsageCost, medicinePurchaseCost, recordCost } from "../src/lib/expenses";

test("expenses: store purchases count when bought, store usage doesn't count again", () => {
  assert.equal(feedPurchaseCost({ bags: 10, pricePerBagNaira: 21000 }), 210000);
  assert.equal(medicinePurchaseCost({ quantity: 4, pricePerUnitNaira: 2500 }), 10000);
  const storeKeys = new Set([stockKey({ feedType: "Layer mash", brand: "Chikun", bagSizeKg: 25 })]);
  assert.equal(feedUsageCost({ feedType: "layer mash", brand: "chikun", bagSizeKg: 25, costNaira: 42000 }, storeKeys), 0);
  assert.equal(feedUsageCost({ feedType: "Grower mash", costNaira: 19000 }, storeKeys), 19000);
  assert.equal(recordCost({ stockKey: "vaccine|lasota|vom|1000", costNaira: 2500 }), 0);
  assert.equal(recordCost({ costNaira: 4500 }), 4500);
  assert.equal(recordCost({}), 0);
});
