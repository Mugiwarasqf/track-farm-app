/** Eggs in store = eggs collected (EggLog) − eggs sold (/sales). Counted in single eggs. */

export const EGGS_PER_CRATE = 30;

export interface EggStock {
  /** Whole farm, after every egg sale (with or without a batch). */
  eggsLeft: number;
  /** Per batch, after the sales that name that batch. */
  byBatch: Record<string, number>;
}

export function eggsInSale(sale: Record<string, any>): number {
  const qty = Number(sale.quantity) || 0;
  return sale.unit === "pieces" ? qty : qty * EGGS_PER_CRATE;
}

export function computeEggStock(
  logsByBatch: Record<string, Record<string, any>[]>,
  sales: Record<string, any>[]
): EggStock {
  const byBatch: Record<string, number> = {};
  let total = 0;
  for (const [batchId, logs] of Object.entries(logsByBatch)) {
    const collected = logs.reduce(
      (sum, l) => sum + (Number(l.crates) || 0) * EGGS_PER_CRATE + (Number(l.looseEggs) || 0),
      0
    );
    if (collected > 0) byBatch[batchId] = collected;
    total += collected;
  }
  for (const s of sales) {
    if (s.product !== "eggs") continue;
    const eggs = eggsInSale(s);
    total -= eggs;
    if (typeof s.batchId === "string" && s.batchId in byBatch) byBatch[s.batchId] -= eggs;
  }
  for (const id of Object.keys(byBatch)) byBatch[id] = Math.max(0, byBatch[id]);
  return { eggsLeft: Math.max(0, total), byBatch };
}
