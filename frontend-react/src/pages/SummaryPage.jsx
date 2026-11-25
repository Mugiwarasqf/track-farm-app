import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBatches } from '../context/BatchContext';
import { getSummary } from '../api/summary';
import { getSales, deleteSale } from '../api/sales';
import { Skeleton } from '../components/ui/Skeleton';
import { SaleModal, EGG_SIZES } from '../components/ui/SaleModal';
import { useToast } from '../components/ui/Toast';
import { ConfirmSheet } from '../components/ui/Sheet';
import { formatNaira } from '../lib/feeds';
import { birdTypeLabel } from '../lib/batch';

/**
 * Income & Expenses: money in (sales) against money out (feed, vaccines,
 * vitamins, birds bought) for the last 7 or 30 days, with the sales behind
 * the income. Totals come from GET /farms/{id}/summary; the list from /sales.
 */

const PERIODS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
];

const INCOME = [
  { key: 'eggRevenueNaira', label: 'Eggs sold' },
  { key: 'birdSalesNaira', label: 'Birds sold' },
];

const EXPENSES = [
  { key: 'feedCostNaira', label: 'Feed' },
  { key: 'vaccineCostNaira', label: 'Vaccines' },
  { key: 'supplementCostNaira', label: 'Vitamins & dewormers' },
  { key: 'birdCostNaira', label: 'Buying birds' },
];

const CARD = 'bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-3xl p-4 sm:p-6 shadow-xs';
const MUTED = 'text-stone-500 dark:text-[#94A3B8]';

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const signed = (n) => (n < 0 ? `-${formatNaira(-n)}` : formatNaira(n));
const eggSizeLabel = (id) => EGG_SIZES.find((s) => s.id === id)?.label || '';

function describeSale(s) {
  const n = Number(s.quantity) || 0;
  if (s.product === 'birds') {
    return `${n.toLocaleString()} ${birdTypeLabel(s.birdType).toLowerCase()} bird${n === 1 ? '' : 's'}`;
  }
  const unit = s.unit === 'pieces' ? `egg${n === 1 ? '' : 's'}` : `crate${n === 1 ? '' : 's'}`;
  return `${n.toLocaleString()} ${unit} · ${eggSizeLabel(s.eggSize)} eggs`;
}

function Total({ icon: Icon, label, value, tone = 'plain', loading }) {
  const color = {
    good: 'text-[#4D6600] dark:text-[#DFFF83]',
    bad: 'text-rose-600 dark:text-rose-400',
    plain: 'text-stone-950 dark:text-[#F5F7F5]',
  }[tone];
  return (
    <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#1E2124] border border-stone-200/80 dark:border-[#2B3238]">
      <span className={`text-xs font-semibold flex items-center gap-1.5 ${MUTED}`}>
        <Icon size={14} className={color} /> {label}
      </span>
      {loading ? <Skeleton className="h-8 sm:h-9 w-28 mt-1" /> : <span className={`text-2xl sm:text-3xl font-extrabold mt-1 block ${color}`}>{value}</span>}
    </div>
  );
}

function Breakdown({ title, rows, data, loading }) {
  const sum = rows.reduce((t, r) => t + (data?.[r.key] || 0), 0);
  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] font-heading">{title}</h3>
        {!loading && <span className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5]">{formatNaira(sum)}</span>}
      </div>
      <ul className="divide-y divide-stone-100 dark:divide-[#2B3238]">
        {rows.map(({ key, label }) => (
          <li key={key} className="flex items-center justify-between py-2.5 text-sm">
            <span className={MUTED}>{label}</span>
            {loading ? <Skeleton className="h-4 w-16" /> : <span className="font-semibold text-stone-950 dark:text-[#F5F7F5]">{formatNaira(data?.[key] || 0)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryPage() {
  const { farmId } = useAuth();
  const { hasBatches, loadBatches } = useBatches();
  const toast = useToast();
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saleOpen, setSaleOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!farmId || !hasBatches) return;
    setLoading(true);
    setError('');
    try {
      const [summary, allSales] = await Promise.all([getSummary(farmId, period), getSales()]);
      setData(summary);
      setSales(allSales.filter((s) => s.date >= summary.startDate && s.date <= summary.endDate));
    } catch {
      setError('Could not load your income and expenses. Check your network and try again.');
    } finally {
      setLoading(false);
    }
  }, [farmId, period, hasBatches]);

  useEffect(() => { load(); }, [load]);

  const removeSale = async () => {
    const sale = toDelete;
    setDeleting(true);
    try {
      await deleteSale(sale.entryId);
      toast('Sale deleted', 'success');
      if (sale.product === 'birds') loadBatches();
      load();
    } catch (err) {
      toast(err.message || 'Could not delete the sale', 'error');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const net = data?.netNaira || 0;
  const busy = loading && !data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-950 dark:text-[#F5F7F5] font-heading">Income &amp; Expenses</h1>
          <p className={`text-xs sm:text-sm ${MUTED}`}>
            {data ? `${shortDate(data.startDate)} to ${shortDate(data.endDate)}` : 'Money in and out of your farm.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-stone-100 dark:bg-[#1E2124] p-1 rounded-xl gap-1" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  period === p.id ? 'bg-white dark:bg-[#2B3238] text-stone-950 dark:text-[#F5F7F5] shadow-xs' : `${MUTED} hover:text-stone-950 dark:hover:text-[#F5F7F5]`
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {hasBatches && (
            <button
              type="button"
              onClick={() => setSaleOpen(true)}
              className="h-10 px-4 rounded-xl bg-[#DFFF83] hover:bg-[#C5E95A] text-[#17191A] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Plus size={15} strokeWidth={2.5} /> Add sale
            </button>
          )}
        </div>
      </div>

      {!hasBatches ? (
        <div className={`${CARD} text-center py-12`}>
          <h2 className="text-lg font-bold text-stone-950 dark:text-[#F5F7F5] font-heading mb-1">Nothing to add up yet</h2>
          <p className={`text-sm max-w-sm mx-auto ${MUTED}`}>Create a batch, then record feed, vaccines and sales to see your income, expenses and profit.</p>
        </div>
      ) : error ? (
        <div className={`${CARD} text-sm text-rose-600 dark:text-rose-400`}>{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Total icon={ArrowDownLeft} label="Income" value={formatNaira(data?.totalIncomeNaira || 0)} loading={busy} />
            <Total icon={ArrowUpRight} label="Expenses" value={formatNaira(data?.totalCostNaira || 0)} loading={busy} />
            <Total icon={net < 0 ? TrendingDown : TrendingUp} label={net < 0 ? 'Loss' : 'Profit'} value={signed(net)} tone={net < 0 ? 'bad' : 'good'} loading={busy} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Breakdown title="Income" rows={INCOME} data={data} loading={busy} />
            <Breakdown title="Expenses" rows={EXPENSES} data={data} loading={busy} />
          </div>
          <p className={`text-sm -mt-2 ${MUTED}`}>
            Feed, vaccines and vitamins you buy for your store count on the day you buy them. Giving them to a batch later doesn't count again.
          </p>

          <div className={CARD}>
            <h3 className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] font-heading mb-2">Sales</h3>
            {sales.length === 0 ? (
              <p className={`text-sm py-2 ${MUTED}`}>No sales recorded in this period. Use “Add sale” when you sell birds or eggs.</p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-[#2B3238]">
                {sales.map((s) => (
                  <li key={s.entryId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-950 dark:text-[#F5F7F5] truncate">{describeSale(s)}</div>
                      <div className={`text-xs truncate ${MUTED}`}>
                        {[shortDate(s.date), s.batchName, s.buyer].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] shrink-0">{formatNaira(s.amountNaira)}</span>
                    <button
                      type="button"
                      onClick={() => setToDelete(s)}
                      aria-label="Delete sale"
                      className="w-11 h-11 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {period === 'month' && data?.weeks?.length > 0 && (
            <div className={CARD}>
              <h3 className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] font-heading mb-2">Week by week</h3>
              <ul className="divide-y divide-stone-100 dark:divide-[#2B3238]">
                {data.weeks.map((w) => (
                  <li key={w.startDate} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-6 py-2.5 text-sm">
                    <span className={MUTED}>{shortDate(w.startDate)} – {shortDate(w.endDate)}</span>
                    <span className={`hidden sm:block ${MUTED}`}>In {formatNaira(w.incomeNaira)}</span>
                    <span className={`hidden sm:block ${MUTED}`}>Out {formatNaira(w.costNaira)}</span>
                    <span className={`font-semibold text-right ${w.netNaira < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-950 dark:text-[#F5F7F5]'}`}>{signed(w.netNaira)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <SaleModal open={saleOpen} onClose={() => setSaleOpen(false)} onSaved={load} />
      <ConfirmSheet
        open={Boolean(toDelete)}
        title="Delete this sale?"
        message={toDelete ? `${describeSale(toDelete)} for ${formatNaira(toDelete.amountNaira)}. This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={removeSale}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
