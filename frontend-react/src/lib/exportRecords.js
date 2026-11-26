import { birdTypeLabel, eggCount, feedBags, formatBags, formatCrates, batchAge, FEED_BAG_KG, EGGS_PER_CRATE } from './batch';
import { ROUTES } from './vaccines';
import { describeDose, findSupplementType } from './supplements';
import { penForBatch } from './pens';

/**
 * Farm-wide records for Export (PDF and CSV), built from collectFarmData().
 * Money headers say "NGN": the PDF fonts have no ₦ glyph.
 */

export const EXPORT_TYPES = [
  { id: 'batches', label: 'Batches' },
  { id: 'vaccinationsDue', label: 'Vaccinations coming up' },
  { id: 'vaccinations', label: 'Vaccinations given' },
  { id: 'mortality', label: 'Deaths' },
  { id: 'eggs', label: 'Eggs collected' },
  { id: 'sales', label: 'Sales' },
  { id: 'feed', label: 'Feed used' },
  { id: 'feedPurchases', label: 'Feed bought' },
  { id: 'medicinePurchases', label: 'Vaccines & vitamins bought' },
  { id: 'supplements', label: 'Vitamins & medicine given' },
  { id: 'sickBay', label: 'Sick bay' },
  { id: 'weight', label: 'Weight' },
];

const n = (v) => Number(v) || 0;
const num = (v) => n(v).toLocaleString();
const money = (v) => Math.round(n(v)).toLocaleString();
const newestFirst = (key) => (a, b) => (b[key] || '').localeCompare(a[key] || '');
const todayIso = () => new Date().toISOString().slice(0, 10);

/** "2026-10-14" → "14 Oct 2026". */
export function day(iso) {
  if (!iso) return '-';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '-');
const sum = (list, fn) => list.reduce((s, x) => s + fn(x), 0);
const saleWhat = (s) =>
  s.product === 'birds'
    ? `${birdTypeLabel(s.birdType)} birds`
    : `${s.eggSize ? `${s.eggSize[0].toUpperCase()}${s.eggSize.slice(1)} ` : ''}eggs (${s.unit === 'pieces' ? 'pieces' : 'crates'})`;

function dueVaccinations(data) {
  const today = todayIso();
  return data.schedule
    .filter((s) => s.status !== 'done' && s.dueDate)
    .map((s) => ({ ...s, overdue: s.dueDate < today || s.status === 'missed' }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Each table: { headers, rows, total? } — total is a last row printed in bold. */
const BUILDERS = {
  batches: (data) => ({
    headers: ['Batch', 'Bird type', 'Status', 'Placed on', 'Age', 'Pen', 'Breed'],
    rows: data.batches.map((b) => [
      b.name,
      birdTypeLabel(b.type),
      (b.status || 'active') === 'closed' ? `Completed ${b.closedAt ? day(b.closedAt) : ''}`.trim() : 'Active',
      day(b.startDate),
      batchAge(b),
      penForBatch(b, data.pens)?.name || b.housing || '-',
      b.breed || '-',
    ]),
  }),
  vaccinationsDue: (data) => ({
    headers: ['Due', 'Batch', 'Vaccine', 'Dose', 'Method', 'Status'],
    rows: dueVaccinations(data).map((s) => [
      day(s.dueDate),
      s.batchName,
      s.vaccineName || '',
      s.doseNumber || '-',
      ROUTES[s.route]?.label || '-',
      s.overdue ? 'Overdue' : 'Due',
    ]),
  }),
  vaccinations: (data) => ({
    headers: ['Date', 'Batch', 'Vaccine', 'Dose', 'Method', 'Birds', 'Given by'],
    rows: [...data.vaccinations].sort(newestFirst('dateAdministered')).map((v) => [
      day(v.dateAdministered),
      v.batchName,
      v.vaccineName || '',
      v.doseNumber || '-',
      ROUTES[v.route]?.label || '-',
      v.birds ? num(v.birds) : '-',
      v.administeredBy || '-',
    ]),
  }),
  mortality: (data) => ({
    headers: ['Date', 'Batch', 'Birds died', 'Cause'],
    rows: [...data.mortality].sort(newestFirst('date')).map((m) => [day(m.date), m.batchName, num(m.count), m.note || '-']),
    total: ['Total', '', num(sum(data.mortality, (m) => n(m.count))), ''],
  }),
  eggs: (data) => {
    const total = sum(data.eggs, eggCount);
    return {
      headers: ['Date', 'Batch', 'Crates', 'Single eggs', 'Total eggs'],
      rows: [...data.eggs].sort(newestFirst('date')).map((e) => [day(e.date), e.batchName, n(e.crates), n(e.looseEggs), num(eggCount(e))]),
      total: ['Total', '', formatCrates(total), '', num(total)],
    };
  },
  sales: (data) => ({
    headers: ['Date', 'What', 'Batch', 'Quantity', 'Buyer', 'Amount (NGN)'],
    rows: [...data.sales].sort(newestFirst('date')).map((s) => [
      day(s.date),
      saleWhat(s),
      s.batchName || '-',
      num(s.quantity),
      s.buyer || '-',
      money(s.amountNaira),
    ]),
    total: ['Total', '', '', '', '', money(sum(data.sales, (s) => n(s.amountNaira)))],
  }),
  feed: (data) => ({
    headers: ['Date', 'Batch', 'Feed type', 'Bags', 'Bag size', 'Cost (NGN)'],
    rows: [...data.feed].sort(newestFirst('date')).map((e) => [
      day(e.date),
      e.batchName,
      e.feedType || '',
      formatBags(feedBags(e)),
      `${n(e.bagSizeKg) || FEED_BAG_KG}kg`,
      e.costNaira ? money(e.costNaira) : '-',
    ]),
    total: ['Total', '', '', formatBags(sum(data.feed, feedBags)), '', money(sum(data.feed, (e) => n(e.costNaira)))],
  }),
  feedPurchases: (data) => ({
    headers: ['Date', 'Feed', 'Bags', 'Bag size', 'Price per bag (NGN)', 'Supplier', 'Cost (NGN)'],
    rows: [...data.feedStock].sort(newestFirst('date')).map((p) => [
      day(p.date),
      [p.feedType, p.brand].filter(Boolean).join(' · '),
      num(p.bags),
      `${n(p.bagSizeKg) || FEED_BAG_KG}kg`,
      p.pricePerBagNaira ? money(p.pricePerBagNaira) : '-',
      p.supplier || '-',
      money(n(p.bags) * n(p.pricePerBagNaira)),
    ]),
    total: ['Total', '', num(sum(data.feedStock, (p) => n(p.bags))), '', '', '', money(sum(data.feedStock, (p) => n(p.bags) * n(p.pricePerBagNaira)))],
  }),
  medicinePurchases: (data) => ({
    headers: ['Date', 'Kind', 'Product', 'Quantity', 'Expiry', 'Supplier', 'Cost (NGN)'],
    rows: [...data.medicinePurchases].sort(newestFirst('date')).map((p) => [
      day(p.date),
      p.kind === 'vaccine' ? 'Vaccine' : 'Vitamin / dewormer',
      [p.name, p.brand, p.kind === 'vaccine' && p.dosesPerVial ? `${num(p.dosesPerVial)} doses` : p.packSize].filter(Boolean).join(' · '),
      `${num(p.quantity)} ${p.kind === 'vaccine' ? 'vials' : 'packs'}`,
      p.expiry ? day(p.expiry) : '-',
      p.supplier || '-',
      money(n(p.quantity) * n(p.pricePerUnitNaira)),
    ]),
    total: ['Total', '', '', '', '', '', money(sum(data.medicinePurchases, (p) => n(p.quantity) * n(p.pricePerUnitNaira)))],
  }),
  supplements: (data) => ({
    headers: ['Started', 'Batch', 'Type', 'Product', 'Dose', 'Reason', 'Withdrawal'],
    rows: [...data.supplements].sort(newestFirst('date')).map((m) => [
      day(m.date),
      m.batchName || '-',
      findSupplementType(m.type)?.label || 'Supplement',
      m.product || '-',
      describeDose(m) || '-',
      m.reason || m.notes || '-',
      m.withdrawalDays ? `${m.withdrawalDays} days` : 'None',
    ]),
  }),
  sickBay: (data) => ({
    headers: ['Isolated', 'Batch', 'Birds', 'Signs', 'Status', 'Recovered', 'Died'],
    rows: [...data.sickBay].sort(newestFirst('dateIsolated')).map((c) => [
      day(c.dateIsolated),
      c.batchName,
      num(c.birdCount),
      (c.symptoms || []).join(', ') || c.reason || '-',
      c.status === 'closed' ? 'Closed' : 'In sick bay',
      c.status === 'closed' ? num(c.recoveredCount) : '-',
      c.status === 'closed' ? num(c.diedCount) : '-',
    ]),
  }),
  weight: (data) => ({
    headers: ['Date', 'Batch', 'Average weight (kg)', 'Birds weighed'],
    rows: [...data.weight].sort(newestFirst('date')).map((w) => [
      day(w.date),
      w.batchName,
      Math.round(n(w.averageWeightKg) * 1000) / 1000,
      w.sampleSize ? num(w.sampleSize) : '-',
    ]),
  }),
};

/** One `{ id, title, headers, rows, total? }` table per requested type. */
export function buildExportSections(data, typeIds) {
  return EXPORT_TYPES.filter((t) => typeIds.includes(t.id)).map((t) => ({ id: t.id, title: t.label, ...BUILDERS[t.id](data) }));
}

/** Page-one summary for the PDF: farm totals, money for the last 30 days, what needs doing. */
export function buildOverview(data) {
  const active = data.batches.filter((b) => (b.status || 'active') !== 'closed');
  const placed = sum(data.batches, (b) => n(b.birdCount));
  const died = sum(data.batches, (b) => n(b.birdsLost));
  const sold = sum(data.sales.filter((x) => x.product === 'birds'), (x) => n(x.quantity));
  const eggs = sum(data.eggs, eggCount);
  const eggsSold = sum(
    data.sales.filter((x) => x.product === 'eggs'),
    (x) => (x.unit === 'pieces' ? n(x.quantity) : n(x.quantity) * EGGS_PER_CRATE)
  );
  const due = dueVaccinations(data);
  const s = data.summary;

  return {
    tiles: [
      { label: 'Birds alive', value: num(sum(active, (b) => n(b.currentBirds ?? b.birdCount))), hint: `${active.length} active batch${active.length === 1 ? '' : 'es'}` },
      { label: 'Deaths', value: num(died), hint: `${pct(died, placed)} of ${num(placed)} placed` },
      { label: 'Birds sold', value: num(sold), hint: 'All time' },
      { label: 'Eggs collected', value: formatCrates(eggs), hint: `${formatCrates(Math.max(eggs - eggsSold, 0))} in store` },
    ],
    attention: [
      ...due.filter((v) => v.overdue).map((v) => `Overdue since ${day(v.dueDate)}: ${vaccineText(v)} for ${v.batchName}`),
      ...due.filter((v) => !v.overdue).slice(0, 5).map((v) => `Due ${day(v.dueDate)}: ${vaccineText(v)} for ${v.batchName}`),
      ...data.sickBay
        .filter((c) => c.status !== 'closed')
        .map((c) => `${num(c.birdCount)} birds from ${c.batchName} in the sick bay since ${day(c.dateIsolated)}`),
    ],
    money: s
      ? {
          period: `${day(s.startDate)} to ${day(s.endDate)}`,
          headers: ['Last 30 days', 'Amount (NGN)'],
          rows: [
            ['Eggs sold', money(s.eggRevenueNaira)],
            ['Birds sold', money(s.birdSalesNaira)],
            { bold: true, cells: ['Money in', money(s.totalIncomeNaira)] },
            ['Feed', money(s.feedCostNaira)],
            ['Vaccines', money(s.vaccineCostNaira)],
            ['Vitamins & dewormers', money(s.supplementCostNaira)],
            ['Buying birds', money(s.birdCostNaira)],
            { bold: true, cells: ['Money out', money(s.totalCostNaira)] },
            { bold: true, cells: [s.netNaira >= 0 ? 'Profit' : 'Loss', money(Math.abs(s.netNaira))] },
          ],
        }
      : null,
  };
}

const vaccineText = (v) => `${v.vaccineName || 'Vaccine'}${v.doseNumber ? ` (${v.doseNumber})` : ''}`;

/**
 * One report per batch: its key facts, then one day-by-day table, like a page
 * of the farm notebook. A column only appears when the batch has that kind of
 * record, so a broiler batch has no Eggs column.
 */
export function buildBatchReports(data) {
  const due = dueVaccinations(data);
  return data.batches.map((b) => {
    const mine = (list) => list.filter((x) => x.batchId === b.batchId);
    const eggs = mine(data.eggs);
    const deaths = mine(data.mortality);
    const feed = mine(data.feed);
    const sales = mine(data.sales);
    const weights = mine(data.weight);

    const days = new Map();
    const at = (date) => {
      const key = String(date || '').slice(0, 10);
      if (!days.has(key)) days.set(key, { eggs: 0, deaths: 0, causes: [], bags: 0, health: [], sold: [], salesNaira: 0, weight: 0 });
      return days.get(key);
    };
    for (const e of eggs) at(e.date).eggs += eggCount(e);
    for (const m of deaths) {
      const d = at(m.date);
      d.deaths += n(m.count);
      if (m.note) d.causes.push(m.note);
    }
    for (const f of feed) at(f.date).bags += feedBags(f);
    for (const v of mine(data.vaccinations)) at(v.dateAdministered).health.push(vaccineText(v));
    for (const m of mine(data.supplements)) {
      const what = m.product || findSupplementType(m.type)?.label || 'Supplement';
      at(m.date).health.push(m.withdrawalDays ? `${what} (${m.withdrawalDays}-day withdrawal)` : what);
    }
    for (const c of mine(data.sickBay)) at(c.dateIsolated).health.push(`${num(c.birdCount)} to sick bay`);
    for (const x of sales) {
      const d = at(x.date);
      d.sold.push(x.product === 'birds' ? `${num(x.quantity)} birds` : `${num(x.quantity)} ${x.unit === 'pieces' ? 'eggs' : 'crates'}`);
      d.salesNaira += n(x.amountNaira);
    }
    for (const w of weights) at(w.date).weight = n(w.averageWeightKg);

    const cols = [
      { h: 'Date', cell: (k) => day(k), total: 'Total' },
      eggs.length
        ? { h: 'Eggs', cell: (_, d) => (d.eggs ? formatCrates(d.eggs) : ''), total: formatCrates(sum(eggs, eggCount)) }
        : null,
      {
        h: 'Deaths',
        cell: (_, d) => (d.deaths ? `${num(d.deaths)}${d.causes.length ? ` (${d.causes.join(', ')})` : ''}` : ''),
        total: num(sum(deaths, (m) => n(m.count))),
      },
      { h: 'Feed used', cell: (_, d) => (d.bags ? formatBags(d.bags) : ''), total: formatBags(sum(feed, feedBags)) },
      { h: 'Health', cell: (_, d) => d.health.join('; '), total: '' },
      sales.length ? { h: 'Sold', cell: (_, d) => d.sold.join(', '), total: '' } : null,
      sales.length
        ? { h: 'Sales (NGN)', cell: (_, d) => (d.salesNaira ? money(d.salesNaira) : ''), total: money(sum(sales, (x) => n(x.amountNaira))) }
        : null,
      weights.length ? { h: 'Avg weight', cell: (_, d) => (d.weight ? `${d.weight} kg` : ''), total: '' } : null,
    ].filter(Boolean);

    const rows = [...days.entries()]
      .sort(([a], [z]) => z.localeCompare(a))
      .map(([k, d]) => cols.map((c) => c.cell(k, d)));

    return {
      title: b.name,
      subtitle: [
        birdTypeLabel(b.type),
        b.breed,
        penForBatch(b, data.pens)?.name || b.housing,
        (b.status || 'active') === 'closed' ? 'Completed' : 'Active',
      ]
        .filter(Boolean)
        .join('  ·  '),
      facts: [
        ['Placed', `${num(b.birdCount)} on ${day(b.startDate)}`],
        ['Age', batchAge(b)],
        ['Died', `${num(b.birdsLost)} (${pct(n(b.birdsLost), n(b.birdCount))})`],
        ['Sold', num(b.birdsSoldToDate)],
        ['Alive', num(b.currentBirds ?? b.birdCount)],
      ],
      headers: cols.map((c) => c.h),
      rows,
      total: cols.map((c) => c.total),
      upcoming: due
        .filter((v) => v.batchId === b.batchId)
        .map((v) => `${v.overdue ? 'Overdue' : 'Due'} ${day(v.dueDate)}: ${vaccineText(v)}`),
    };
  });
}

/** Records that belong to no single batch: store purchases, and sales without a batch. */
export function buildFarmSections(data) {
  const sections = buildExportSections(data, ['feedPurchases', 'medicinePurchases']);
  const loose = data.sales.filter((x) => !x.batchId);
  if (loose.length) sections.push({ id: 'looseSales', title: 'Sales not tied to a batch', ...BUILDERS.sales({ ...data, sales: loose }) });
  return sections;
}

/** CSV text with every cell quoted; the BOM makes Excel read ₦ and accents correctly. */
export function toCsv(headers, rows) {
  const quote = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}
