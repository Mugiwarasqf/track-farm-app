import { Plus, AlertTriangle, Package } from 'lucide-react';
import { VaccineIcon } from '../ui/VaccineIcon';
import { PillIcon } from '../ui/PillIcon';
import { SkeletonRows } from '../ui/Skeleton';
import { formatNaira } from '../../lib/feeds';
import { formatDate } from '../../lib/batch';
import { medicineStockKey, unitWord } from '../../lib/medicineStock';

const CARD = 'bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-3xl p-5 sm:p-6 shadow-xs';
const MUTED = 'text-stone-500 dark:text-[#94A3B8]';
const STRONG = 'text-stone-950 dark:text-[#F5F7F5]';

function Stat({ label, value, hint, tone }) {
  return (
    <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#1E2124] border border-stone-200/80 dark:border-[#2B3238]">
      <div className={`text-sm ${MUTED}`}>{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : STRONG}`}>{value}</div>
      {hint && <div className={`text-sm mt-0.5 ${MUTED}`}>{hint}</div>}
    </div>
  );
}

/**
 * Store tab for vaccines or vitamins/dewormers bought in bulk: what's left,
 * what it's worth, what's low or expiring, and what came in and went out.
 * Giving it to a batch happens on the batch, which takes it out of here.
 *
 * Props: kind ('vaccine' | 'supplement'), stock (useMedicineStock result), onAdd()
 */
export function MedicineStoreTab({ kind, stock, onAdd }) {
  const isVaccine = kind === 'vaccine';
  const Icon = isVaccine ? VaccineIcon : PillIcon;
  const lines = stock.lines.filter((l) => l.kind === kind);
  const firstLoad = stock.loading && stock.purchases.length === 0;
  const unitsLeft = lines.reduce((s, l) => s + Math.max(l.left, 0), 0);
  const value = lines.reduce((s, l) => s + l.value, 0);
  const attention = lines.filter((l) => l.left > 0 && (l.status !== 'ok' || l.expiringSoon)).length + lines.filter((l) => l.left <= 0).length;

  const keys = new Set(lines.map((l) => l.key));
  const activity = [
    ...stock.purchases
      .filter((p) => p.kind === kind)
      .map((p) => ({
        key: `in-${p.entryId}`,
        date: p.date,
        what: lines.find((l) => l.key === medicineStockKey(p))?.label || p.name,
        who: p.supplier ? `Bought from ${p.supplier}` : 'Bought',
        units: `+${p.quantity}`,
        amount: (Number(p.quantity) || 0) * (Number(p.pricePerUnitNaira) || 0),
      })),
    ...stock.usage
      .filter((u) => keys.has(u.stockKey))
      .map((u, i) => ({
        key: `out-${i}-${u.stockKey}-${u.date}`,
        date: u.date,
        what: lines.find((l) => l.key === u.stockKey)?.label || u.name,
        who: u.batchName ? `Given to ${u.batchName}` : 'Given',
        units: `−${u.units}`,
      })),
  ]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 20);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className={`${CARD} space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Icon size={24} className="text-[#4D6600] dark:text-[#DFFF83] shrink-0" />
            <div>
              <h3 className={`text-lg font-bold font-heading ${STRONG}`}>{isVaccine ? 'Vaccines in store' : 'Vitamins & dewormers in store'}</h3>
              <p className={`text-sm ${MUTED}`}>What you bought and kept. Giving it to a batch takes it out of here.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="h-11 px-5 rounded-xl bg-[#DFFF83] hover:bg-[#C5E95A] text-[#17191A] text-sm font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} /> {isVaccine ? 'Add vaccines bought' : 'Add vitamins bought'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="In store" value={`${unitsLeft} ${unitWord(kind, unitsLeft)}`} hint={`${lines.filter((l) => l.left > 0).length} products`} />
          <Stat label="Worth" value={formatNaira(value)} hint="At what you paid" />
          <Stat label="Needs attention" value={attention} hint="Low, out or expiring within 30 days" tone={attention ? 'warn' : undefined} />
        </div>

        {firstLoad ? (
          <SkeletonRows rows={3} />
        ) : lines.length === 0 ? (
          <div className={`flex items-center gap-3 rounded-2xl border border-dashed border-stone-300 dark:border-[#2B3238] p-5 ${MUTED}`}>
            <Package size={20} className="shrink-0" />
            <span className="text-sm">
              Nothing in store yet. When you buy {isVaccine ? 'vaccines' : 'vitamins or dewormers'} to keep, add them here.
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-[#2B3238]">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className={`text-base font-semibold truncate ${STRONG}`}>{l.label}</div>
                  <div className={`text-sm ${l.expiringSoon ? 'text-amber-700 dark:text-amber-400 font-semibold' : MUTED}`}>
                    {l.expiry ? `${l.expiringSoon ? 'Expires soon: ' : 'Expires '}${formatDate(l.expiry)}` : 'No expiry recorded'}
                    {l.avgPrice ? ` · ${formatNaira(l.avgPrice)} each` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-base font-bold ${l.left <= 0 ? 'text-rose-600 dark:text-rose-400' : STRONG}`}>
                    {Math.max(l.left, 0)} {unitWord(kind, Math.max(l.left, 0))}
                  </div>
                  {l.status !== 'ok' && (
                    <div className="text-sm text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                      <AlertTriangle size={13} /> {l.status === 'out' ? 'Out' : 'Running low'}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={CARD}>
        <h4 className={`text-base font-bold font-heading mb-2 ${STRONG}`}>Bought and used</h4>
        {activity.length === 0 ? (
          <p className={`py-4 text-sm ${MUTED}`}>Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-[#2B3238]">
            {activity.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${STRONG}`}>{a.what}</div>
                  <div className={`text-sm truncate ${MUTED}`}>{formatDate(a.date)} · {a.who}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${a.units.startsWith('+') ? 'text-[#4D6600] dark:text-[#DFFF83]' : STRONG}`}>{a.units}</div>
                  {a.amount > 0 && <div className={`text-sm ${MUTED}`}>{formatNaira(a.amount)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
