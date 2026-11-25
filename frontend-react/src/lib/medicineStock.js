/**
 * Vaccines and vitamins/dewormers in the farm's store, worked out the same
 * way as feed (lib/feeds.js): bought (POST /medicine-stock) minus what batch
 * records took (vaccination vialsUsed, supplement packsUsed), matched on a
 * stockKey saved on the record when it came from the store.
 */

const norm = (s) => String(s || '').trim().toLowerCase();

/** One stock line: same product, same vial or pack size. */
export function medicineStockKey({ kind, name, brand, dosesPerVial, packSize }) {
  return kind === 'vaccine'
    ? `vaccine|${norm(name)}|${norm(brand)}|${Number(dosesPerVial) || 0}`
    : `supplement|${norm(name)}|${norm(packSize)}`;
}

export const unitWord = (kind, n = 2) =>
  kind === 'vaccine' ? (n === 1 ? 'vial' : 'vials') : n === 1 ? 'pack' : 'packs';

/**
 * usage: [{ stockKey, units, date, batchName }]
 * Returns lines, in-stock first, each with bought/used/left, average price,
 * value left, the soonest expiry still ahead, and a status.
 */
export function computeMedicineStock(purchases = [], usage = [], today = new Date().toISOString().slice(0, 10)) {
  const lines = new Map();
  for (const p of purchases) {
    const key = medicineStockKey(p);
    if (!lines.has(key)) {
      lines.set(key, {
        key,
        kind: p.kind,
        name: p.name,
        brand: p.brand || '',
        dosesPerVial: Number(p.dosesPerVial) || null,
        packSize: p.packSize || '',
        supplementType: p.supplementType || '',
        bought: 0,
        used: 0,
        pricedUnits: 0,
        spent: 0,
        expiry: '',
      });
    }
    const line = lines.get(key);
    const qty = Number(p.quantity) || 0;
    line.bought += qty;
    if (Number(p.pricePerUnitNaira) > 0) {
      line.pricedUnits += qty;
      line.spent += qty * Number(p.pricePerUnitNaira);
    }
    if (p.expiry && p.expiry >= today && (!line.expiry || p.expiry < line.expiry)) line.expiry = p.expiry;
  }

  for (const u of usage) {
    const line = lines.get(u.stockKey);
    if (line) line.used += Number(u.units) || 0;
  }

  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10);
  return [...lines.values()]
    .map((line) => {
      const left = line.bought - line.used;
      const avgPrice = line.pricedUnits ? line.spent / line.pricedUnits : null;
      const size = line.kind === 'vaccine' ? `${(line.dosesPerVial || 0).toLocaleString()} doses` : line.packSize;
      return {
        ...line,
        left,
        avgPrice,
        value: avgPrice ? Math.max(left, 0) * avgPrice : 0,
        label: [line.name, line.brand, size].filter(Boolean).join(' · '),
        status: left <= 0 ? 'out' : left <= 1 ? 'low' : 'ok',
        expiringSoon: Boolean(line.expiry && line.expiry <= soon),
      };
    })
    .sort((a, b) => (b.left > 0) - (a.left > 0) || a.label.localeCompare(b.label));
}
