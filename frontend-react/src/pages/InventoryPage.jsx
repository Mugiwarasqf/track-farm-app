import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  Clock,
  CircleMinus,
  CirclePlus,
  PackagePlus,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBatches } from '../context/BatchContext';
import { LOGS_CHANGED_EVENT, getLogs } from '../api/logs';
import { getEggStock } from '../api/sales';
import { toIso } from '../lib/supplements';
import { useMedicineStock } from '../lib/useMedicineStock';
import { MedicinePurchaseModal } from '../components/ui/MedicinePurchaseModal';
import { MedicineStoreTab } from '../components/store/MedicineStoreTab';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { FeedPurchaseModal } from '../components/ui/FeedPurchaseModal';
import { FeedUsageModal } from '../components/ui/FeedUsageModal';
import { useFeedStock } from '../lib/useFeedStock';
import { formatNaira } from '../lib/feeds';
import { eggCount, feedBags, formatBags, formatCrates, formatDate, laysEggs } from '../lib/batch';
import { FeedIcon } from '../components/ui/FeedIcon';
import { EggIcon } from '../components/ui/EggIcon';
import { MoneyIcon } from '../components/ui/MoneyIcon';
import { InventoryIcon } from '../components/ui/InventoryIcon';
import { CalendarIcon } from '../components/ui/CalendarIcon';

function StatCard({ icon: Icon, label, value, hint, loading = false }) {
  return (
    <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#1E2124] border border-stone-200/80 dark:border-[#2B3238] transition-colors" aria-busy={loading || undefined}>
      <span className="text-xs font-semibold text-stone-500 dark:text-[#94A3B8] flex items-center gap-1.5">
        <Icon size={14} className="text-[#4D6600] dark:text-[#DFFF83]" /> {label}
      </span>
      {loading ? (
        // Same height as the real number and hint, so nothing shifts when data lands.
        <>
          <Skeleton className="h-8 sm:h-9 w-24 mt-1" />
          <Skeleton className="h-3 w-20 mt-1.5" />
        </>
      ) : (
        <>
          <span className="text-2xl sm:text-3xl font-extrabold text-stone-950 dark:text-[#F5F7F5] mt-1 block">{value}</span>
          {hint && <span className="text-xs text-stone-500 dark:text-[#94A3B8] mt-0.5 block">{hint}</span>}
        </>
      )}
    </div>
  );
}

/** Placeholder for a feed-store card while stock loads. */
function StockCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-2xl p-5 shadow-xs flex flex-col gap-3" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-7" />
        <Skeleton className="h-7" />
      </div>
      <Skeleton className="h-8 w-full rounded-xl" />
    </div>
  );
}

const INVENTORY_TABS = ['feed', 'eggs', 'vaccines', 'vitamins'];

export function InventoryPage() {
  const { batches } = useBatches();

  // ?tab=vaccines etc. opens that tab directly instead of feed.
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab');
    return INVENTORY_TABS.includes(requested) ? requested : 'feed';
  }); // 'feed' | 'eggs' | 'vaccines' | 'vitamins'
  const [loading, setLoading] = useState(true);

  // Aggregated data across all batches
  const feedStore = useFeedStock();
  const [allEggLogs, setAllEggLogs] = useState([]);
  const [eggStock, setEggStock] = useState(null);
  const medicine = useMedicineStock();

  // Modal states
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usagePreset, setUsagePreset] = useState('');
  const [medicineModal, setMedicineModal] = useState(null); // 'vaccine' | 'supplement'

  // Load eggs and vaccinations across all batches (feed comes from useFeedStock).
  // Only the first load shows skeletons; later refreshes (a log saved
  // elsewhere, the tab coming back into view) swap the numbers in place.
  // A request counter drops responses from refreshes that were overtaken.
  const loadSeq = useRef(0);
  const loadedOnce = useRef(false);
  const loadAllInventory = useCallback(async () => {
    const seq = ++loadSeq.current;
    const isCurrent = () => seq === loadSeq.current;
    if (batches.length === 0) {
      setLoading(false);
      return;
    }
    if (!loadedOnce.current) setLoading(true);
    try {
      // Every egg a layer batch records counts toward the farm's egg stock.
      const eggPromises = batches.filter(b => laysEggs(b.type)).map(async b => {
        try {
          const res = await getLogs(b.batchId, 'eggs');
          return (res.logs || []).map(log => ({ ...log, batchId: b.batchId, batchName: b.name }));
        } catch {
          return [];
        }
      });

      const [eggsNested, stock] = await Promise.all([
        Promise.all(eggPromises),
        getEggStock().catch(() => null),
      ]);

      if (isCurrent()) {
        const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
        setAllEggLogs(eggsNested.flat().sort(byDateDesc));
        setEggStock(stock);
        loadedOnce.current = true;
      }
    } catch (err) {
      console.error('Inventory aggregate load error:', err);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [batches]);

  useEffect(() => {
    loadAllInventory();
    // Bumping the counter on unmount drops any response still in flight.
    return () => { loadSeq.current += 1; };
  }, [loadAllInventory]);

  // Refresh when a log is saved anywhere in the app, or when the farmer
  // comes back to this tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAllInventory();
    };
    window.addEventListener(LOGS_CHANGED_EVENT, loadAllInventory);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(LOGS_CHANGED_EVENT, loadAllInventory);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadAllInventory]);

  const today = toIso(new Date());
  const thisMonth = today.slice(0, 7);
  const batchNames = Object.fromEntries(batches.map(b => [b.batchId, b.name]));

  // Feed store: purchases in, batch usage out.
  const { lines: stockLines } = feedStore.stock;
  // First load only: later background refreshes keep showing the real numbers.
  const feedLoading = feedStore.loading && feedStore.purchases.length === 0 && feedStore.usage.length === 0;
  const bagsInStore = stockLines.reduce((sum, l) => sum + Math.max(l.left, 0), 0);
  const storeValue = stockLines.reduce((sum, l) => sum + l.value, 0);
  const lowLines = stockLines.filter(l => l.status !== 'ok');
  const bagsUsedThisMonth = feedStore.usage
    .filter(u => (u.date || '').startsWith(thisMonth))
    .reduce((sum, u) => sum + feedBags(u), 0);
  const boughtThisMonth = feedStore.purchases.filter(p => (p.date || '').startsWith(thisMonth));
  const bagsBoughtThisMonth = boughtThisMonth.reduce((sum, p) => sum + (Number(p.bags) || 0), 0);
  const spentThisMonth = boughtThisMonth.reduce((sum, p) => sum + (Number(p.bags) || 0) * (Number(p.pricePerBagNaira) || 0), 0);
  const feedActivity = [
    ...feedStore.purchases.map(p => ({
      key: `in-${p.entryId}`,
      kind: 'in',
      date: p.date,
      feed: [p.feedType, p.brand].filter(Boolean).join(' · '),
      who: p.supplier ? `Bought from ${p.supplier}` : 'Bought',
      bags: Number(p.bags) || 0,
      amount: (Number(p.bags) || 0) * (Number(p.pricePerBagNaira) || 0),
    })),
    ...feedStore.usage.map((u, i) => ({
      key: `out-${u.entryId || i}`,
      kind: 'out',
      date: u.date,
      feed: [u.feedType, u.brand].filter(Boolean).join(' · ') || 'Feed',
      who: u.batchName || batchNames[u.batchId] || 'Batch',
      bags: feedBags(u),
      amount: Number(u.costNaira) || 0,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Eggs in store: collected minus sold (worked out by GET /sales).
  const totalEggsStocked = eggStock ? eggStock.eggsLeft : allEggLogs.reduce((sum, log) => sum + eggCount(log), 0);
  const eggsThisMonth = allEggLogs
    .filter(log => (log.date || '').startsWith(thisMonth))
    .reduce((sum, log) => sum + eggCount(log), 0);
  const eggsToday = allEggLogs
    .filter(log => log.date === today)
    .reduce((sum, log) => sum + eggCount(log), 0);
  const eggsByBatch = batches
    .filter(b => laysEggs(b.type))
    .map(b => ({
      batchId: b.batchId,
      name: b.name,
      eggs: eggStock ? eggStock.byBatch[b.batchId] || 0 : allEggLogs.filter(log => log.batchId === b.batchId).reduce((sum, log) => sum + eggCount(log), 0),
    }));

  // Actions
  const openUsage = (presetKey = '') => {
    setUsagePreset(presetKey);
    setShowUsageModal(true);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header with Back Arrow matching reference image */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-[#1E2124] text-stone-600 dark:text-[#94A3B8] hover:text-stone-950 dark:hover:text-[#F5F7F5] transition-colors"
          aria-label="Back to home"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-950 dark:text-[#F5F7F5] font-heading">
            Store
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-[#94A3B8]">
            Feed, vaccines and vitamins you've bought and kept, and the eggs you have.
          </p>
        </div>
      </div>

      {/* Inventory Navigation Tabs */}
      <div className="flex items-center gap-0 border-b border-stone-200 dark:border-[#2B3238] overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { id: 'feed', label: 'Feed' },
          { id: 'eggs', label: 'Eggs' },
          { id: 'vaccines', label: 'Vaccines' },
          { id: 'vitamins', label: 'Vitamins' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#B7DA3E] dark:border-[#DFFF83] text-[#4D6600] dark:text-[#DFFF83]'
                : 'border-transparent text-stone-500 dark:text-[#94A3B8] hover:text-stone-900 dark:hover:text-[#F5F7F5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB 1: FEED ===================== */}
      {activeTab === 'feed' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl text-[#4D6600] dark:text-[#DFFF83] flex items-center justify-center shadow-2xs shrink-0">
                  <FeedIcon size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-950 dark:text-[#F5F7F5] font-heading">Feed Store</h3>
                  <p className="text-xs text-stone-500 dark:text-[#94A3B8]">Feed you bought, minus what your batches have used</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => openUsage()}
                  className="w-full sm:w-auto px-4 py-2.5 border border-[#D2EC7A] dark:border-[#334418] text-[#4D6600] dark:text-[#DFFF83] hover:bg-[#F7FFE0] dark:hover:bg-[#1C2612] rounded-xl text-sm font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <CircleMinus size={16} /> Record Usage
                </button>
                <button
                  onClick={() => setShowPurchaseModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#DFFF83] hover:bg-[#C5E95A] text-[#17191A] rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <PackagePlus size={16} /> Add Feed Stock
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard loading={feedLoading} icon={InventoryIcon} label="Bags in store" value={formatBags(bagsInStore)} hint={lowLines.length ? `${lowLines.length} running low` : 'Stock levels OK'} />
              <StatCard loading={feedLoading} icon={MoneyIcon} label="Store value" value={formatNaira(storeValue)} hint="At the price you paid" />
              <StatCard loading={feedLoading} icon={CircleMinus} label="Used this month" value={formatBags(bagsUsedThisMonth)} />
              <StatCard loading={feedLoading} icon={CirclePlus} label="Bought this month" value={formatNaira(spentThisMonth)} hint={formatBags(bagsBoughtThisMonth)} />
            </div>
          </div>

          {/* One card per kind of feed in the store */}
          {feedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" role="status" aria-label="Loading the feed store">
              <StockCardSkeleton />
              <StockCardSkeleton />
              <StockCardSkeleton />
            </div>
          ) : feedStore.stock.lines.length === 0 ? (
            <div className="bg-white dark:bg-[#17191A] border border-dashed border-stone-300 dark:border-[#2B3238] rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-stone-800 dark:text-[#F5F7F5]">Your feed store is empty</p>
              <p className="text-xs text-stone-500 dark:text-[#94A3B8] max-w-md mx-auto">
                {feedStore.error
                  ? 'The feed store could not be loaded. It needs the latest backend deployed.'
                  : 'Add the feed you buy here. When a batch records feed, it comes off this stock automatically.'}
              </p>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="px-5 py-2.5 bg-[#DFFF83] hover:bg-[#C5E95A] text-[#17191A] rounded-xl text-sm font-bold cursor-pointer inline-flex items-center gap-2"
              >
                <PackagePlus size={16} /> Add Feed Stock
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {feedStore.stock.lines.map((line) => {
                const pct = line.bought ? Math.max(0, Math.min(100, (line.left / line.bought) * 100)) : 0;
                const badge = line.status === 'out'
                  ? { text: 'Out of stock', cls: 'bg-rose-50 dark:bg-[#260D12] text-rose-700 dark:text-[#FB7185] border-rose-200 dark:border-[#4C1A24]' }
                  : line.status === 'low'
                  ? { text: 'Running low', cls: 'bg-amber-50 dark:bg-[#261B06] text-amber-800 dark:text-[#FCD34D] border-amber-200 dark:border-[#4A350C]' }
                  : null;
                return (
                  <div key={line.key} className="bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] truncate">{line.feedType}</div>
                        <div className="text-xs text-stone-500 dark:text-[#94A3B8] truncate">
                          {[line.brand, `${line.bagSizeKg}kg bags`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {badge && <span className={`px-2 py-0.5 rounded-full border text-xs font-bold shrink-0 ${badge.cls}`}>{badge.text}</span>}
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-3xl font-extrabold ${line.left <= 0 ? 'text-rose-600 dark:text-[#FB7185]' : 'text-stone-950 dark:text-[#F5F7F5]'}`}>
                          {Math.max(line.left, 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-[#94A3B8]">bag{line.left === 1 ? '' : 's'} left of {line.bought.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-[#1E2124] h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all ${line.status === 'out' ? 'bg-rose-500' : line.status === 'low' ? 'bg-amber-500' : 'bg-[#DFFF83]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-stone-400 dark:text-[#64748B] block">Lasts about</span>
                        <span className="font-bold text-stone-800 dark:text-[#F5F7F5]">
                          {line.left <= 0 ? '—' : line.daysLeft == null ? 'No recent use' : `${line.daysLeft} day${line.daysLeft === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 dark:text-[#64748B] block">Average price</span>
                        <span className="font-bold text-stone-800 dark:text-[#F5F7F5]">{line.avgPrice ? `${formatNaira(line.avgPrice)}/bag` : '—'}</span>
                      </div>
                    </div>

                    {line.bestBefore && (
                      <div className="text-xs text-amber-800 dark:text-[#FCD34D] bg-amber-50 dark:bg-[#261B06] border border-amber-200 dark:border-[#4A350C] rounded-lg px-2.5 py-1.5">
                        Use before {formatDate(line.bestBefore)}
                      </div>
                    )}

                    <button
                      onClick={() => openUsage(line.key)}
                      disabled={line.left <= 0}
                      className="mt-auto w-full py-2 rounded-xl border border-stone-200 dark:border-[#2B3238] text-xs font-bold text-stone-700 dark:text-[#94A3B8] hover:border-[#D2EC7A] dark:hover:border-[#DFFF83] hover:text-[#4D6600] dark:hover:text-[#DFFF83] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Record usage from this feed
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Everything that went in and out */}
          <div className="bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] font-heading">Feed Activity</h4>
            {feedLoading ? (
              <SkeletonRows rows={4} />
            ) : feedActivity.length === 0 ? (
              <p className="py-6 text-center text-xs text-stone-400 dark:text-[#64748B] font-medium">No feed bought or used yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 dark:border-[#2B3238] text-stone-400 dark:text-[#94A3B8] uppercase text-xs">
                    <tr>
                      <th className="py-3 font-bold">Date</th>
                      <th className="py-3 font-bold">Feed</th>
                      <th className="py-3 font-bold hidden sm:table-cell">Batch / Supplier</th>
                      <th className="py-3 font-bold text-right">Bags</th>
                      <th className="py-3 font-bold text-right hidden sm:table-cell">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[#2B3238] font-medium">
                    {feedActivity.slice(0, 20).map((row) => (
                      <tr key={row.key} className="hover:bg-stone-50/60 dark:hover:bg-[#1E2124]/50 transition-colors">
                        <td className="py-3 text-stone-700 dark:text-[#94A3B8] whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="py-3">
                          <div className="font-semibold text-stone-900 dark:text-[#F5F7F5]">{row.feed}</div>
                          <div className="text-xs text-stone-400 dark:text-[#64748B] sm:hidden">{row.who}</div>
                        </td>
                        <td className="py-3 text-stone-600 dark:text-[#94A3B8] hidden sm:table-cell">{row.who}</td>
                        <td className={`py-3 text-right font-bold whitespace-nowrap ${row.kind === 'in' ? 'text-[#4D6600] dark:text-[#DFFF83]' : 'text-stone-900 dark:text-[#F5F7F5]'}`}>
                          {row.kind === 'in' ? '+' : '−'}{Math.round(row.bags * 100) / 100}
                        </td>
                        <td className="py-3 text-right text-stone-600 dark:text-[#94A3B8] hidden sm:table-cell">{row.amount ? formatNaira(row.amount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {feedStore.stock.untracked.length > 0 && (
              <p className="text-xs text-stone-400 dark:text-[#64748B]">
                {feedStore.stock.untracked.length} usage entr{feedStore.stock.untracked.length === 1 ? 'y was' : 'ies were'} recorded without matching feed in the store (for example, before the store existed), so they don't reduce the stock above.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB: EGGS ===================== */}
      {activeTab === 'eggs' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl text-[#4D6600] dark:text-[#DFFF83] flex items-center justify-center shadow-2xs shrink-0">
                <EggIcon size={22} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-950 dark:text-[#F5F7F5] font-heading">Eggs in store</h3>
                <p className="text-xs text-stone-500 dark:text-[#94A3B8]">Eggs collected, minus eggs sold</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <StatCard
                loading={loading}
                icon={EggIcon}
                label="Eggs in store"
                value={totalEggsStocked.toLocaleString()}
                hint={formatCrates(totalEggsStocked)}
              />
              <StatCard loading={loading} icon={CalendarIcon} label="Collected This Month" value={eggsThisMonth.toLocaleString()} hint={formatCrates(eggsThisMonth)} />
              <StatCard loading={loading} icon={Clock} label="Collected Today" value={eggsToday.toLocaleString()} hint={formatCrates(eggsToday)} />
            </div>

            {eggsByBatch.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-stone-800 dark:text-[#F5F7F5] block">By batch</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {eggsByBatch.map(b => (
                    <Link
                      key={b.batchId}
                      to={`/batches/${b.batchId}`}
                      className="flex items-center justify-between p-3 rounded-xl border border-stone-200/80 dark:border-[#2B3238] hover:border-[#D2EC7A] dark:hover:border-[#DFFF83] hover:bg-[#F7FFE0]/40 dark:hover:bg-[#1C2612]/40 transition-colors"
                    >
                      <span className="text-xs font-bold text-stone-900 dark:text-[#F5F7F5] truncate">{b.name}</span>
                      <span className="text-xs text-stone-600 dark:text-[#94A3B8] shrink-0">
                        {loading ? <Skeleton className="h-3.5 w-16" /> : <><span className="font-extrabold text-stone-950 dark:text-[#F5F7F5]">{b.eggs.toLocaleString()}</span> eggs</>}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#17191A] border border-stone-200/90 dark:border-[#2B3238] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-stone-950 dark:text-[#F5F7F5] font-heading">Recent Egg Collections</h4>

            {loading ? (
              <SkeletonRows rows={4} />
            ) : allEggLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-stone-400 dark:text-[#64748B] font-medium">
                {eggsByBatch.length === 0
                  ? 'No layer batches yet. Eggs appear here once a layer batch records production.'
                  : 'No eggs recorded yet. Log eggs from a layer batch and they will be added here.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 dark:border-[#2B3238] text-stone-400 dark:text-[#94A3B8] uppercase text-xs">
                    <tr>
                      <th className="py-3 font-bold">Date</th>
                      <th className="py-3 font-bold">Batch</th>
                      <th className="py-3 font-bold">Crates</th>
                      <th className="py-3 font-bold">Loose</th>
                      <th className="py-3 font-bold text-right">Total Eggs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[#2B3238] font-medium">
                    {allEggLogs.slice(0, 15).map((log, idx) => (
                      <tr key={log.entryId || idx} className="hover:bg-stone-50/60 dark:hover:bg-[#1E2124]/50 transition-colors">
                        <td className="py-3.5 text-stone-900 dark:text-[#F5F7F5] font-semibold">{formatDate(log.date)}</td>
                        <td className="py-3.5 text-stone-700 dark:text-[#94A3B8]">{log.batchName}</td>
                        <td className="py-3.5 text-stone-700 dark:text-[#94A3B8]">{Number(log.crates) || 0}</td>
                        <td className="py-3.5 text-stone-700 dark:text-[#94A3B8]">{Number(log.looseEggs) || 0}</td>
                        <td className="py-3.5 font-bold text-stone-950 dark:text-[#F5F7F5] text-right">{eggCount(log).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vaccines' && (
        <MedicineStoreTab kind="vaccine" stock={medicine} onAdd={() => setMedicineModal('vaccine')} />
      )}
      {activeTab === 'vitamins' && (
        <MedicineStoreTab kind="supplement" stock={medicine} onAdd={() => setMedicineModal('supplement')} />
      )}

      <FeedPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSaved={feedStore.addPurchase}
      />

      <FeedUsageModal
        isOpen={showUsageModal}
        onClose={() => setShowUsageModal(false)}
        onSaved={feedStore.addUsage}
        presetKey={usagePreset}
        onAddStock={() => {
          setShowUsageModal(false);
          setShowPurchaseModal(true);
        }}
      />


      <MedicinePurchaseModal
        open={Boolean(medicineModal)}
        kind={medicineModal || 'vaccine'}
        onClose={() => setMedicineModal(null)}
        onSaved={medicine.addPurchase}
      />
    </div>
  );
}

export default InventoryPage;
