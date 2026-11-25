import { stockKey } from "./feedStock";

/**
 * Money out is counted when it's spent: store purchases (feed, vaccines,
 * vitamins) on the day bought. A record that took from the store adds
 * nothing more, or the same money would count twice. Things bought straight
 * for a batch (not from the store) count on the day they're recorded.
 */

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export const feedPurchaseCost = (p: Record<string, any>) => num(p.bags) * num(p.pricePerBagNaira);

export const medicinePurchaseCost = (p: Record<string, any>) => num(p.quantity) * num(p.pricePerUnitNaira);

/** Feed usage matching a line bought into the store was paid for at purchase. */
export function feedUsageCost(log: Record<string, any>, storeKeys: Set<string>): number {
  return storeKeys.has(stockKey(log)) ? 0 : num(log.costNaira);
}

/** Vaccination or vitamin record: free if it came from the store, else its own cost. */
export function recordCost(record: Record<string, any>): number {
  return typeof record.stockKey === "string" && record.stockKey ? 0 : num(record.costNaira);
}
