import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChartLine,
  ChevronDown,
  ChevronRight,
  Clock,
  PlusCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBatches } from '../context/BatchContext';
import { getLogs, LOGS_CHANGED_EVENT } from '../api/logs';
import { getSchedule } from '../api/schedule';
import { getVaccinationRecords } from '../api/vaccinations';
import { getFeedPurchases } from '../api/feedStock';
import { BATCHES_PER_GROUP, inGroups, safe } from '../lib/farmData';
import { computeFeedStock } from '../lib/feeds';
import { buildHealthEvents } from '../lib/healthEvents';
import { loadSupplements, toIso } from '../lib/supplements';
import {
  batchAge,
  batchImage,
  birdPurpose,
  birdTypeLabel,
  computeFCR,
  eggCount,
  feedBags,
  formatBags,
  laysEggs,
} from '../lib/batch';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { LineChart } from '../components/ui/LineChart';
import { buildPerformance, daysUntil, dueWhen, isoDaysAgo, round1, stamp } from '../lib/production';
import { FeedUsageModal } from '../components/ui/FeedUsageModal';
import { FeedPurchaseModal } from '../components/ui/FeedPurchaseModal';
import { VaccinationModal } from '../components/ui/VaccinationModal';
import { BirdIcon } from '../components/ui/BirdIcon';
import { VaccineIcon } from '../components/ui/VaccineIcon';
import { FeedIcon } from '../components/ui/FeedIcon';
import { EggIcon } from '../components/ui/EggIcon';
import { BatchIcon } from '../components/ui/BatchIcon';
import { HistoryIcon } from '../components/ui/HistoryIcon';
import { CalendarIcon } from '../components/ui/CalendarIcon';

// The dashboard is a summary: three batches here plus a "More" card, the full list on /batches.
const MAX_VISIBLE_BATCHES = 3;
const ACTIVITY_COLLAPSED = 4;
const ACTIVITY_EXPANDED = 10;
// "Record Vaccination" opens the existing form already in record mode.
const RECORD_PREFILL = { mode: 'record' };
const FIRST_BATCH_DISMISSED_KEY = 'farmbook_first_batch_prompt_dismissed';

const isActive = (b) => (b.status || 'active') !== 'closed';

// ---- presentational pieces ----------------------------------------------------

function Card({ className = '', children }) {
  return (
    <section className={`bg-white dark:bg-[#17191A] rounded-2xl border border-[#E1E8EF] dark:border-[#2B3238] shadow-[0_1px_3px_rgba(20,32,51,0.05)] transition-colors ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <span className="w-9 h-9 rounded-full bg-[#F7FFE0] dark:bg-[#1E2124] flex items-center justify-center shrink-0">
          <Icon size={18} strokeWidth={2} className="text-[#142033] dark:text-[#DFFF83]" />
        </span>
        <h2 className="text-base sm:text-lg font-semibold text-[#142033] dark:text-[#F5F7F5] font-heading truncate">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ViewAll({ to, onClick, children = 'View all' }) {
  const cls = 'inline-flex items-center gap-1 text-xs font-semibold text-[#142033]/80 dark:text-[#94A3B8] hover:text-[#4D6600] dark:hover:text-[#DFFF83] transition-colors shrink-0 cursor-pointer';
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children} <ChevronRight size={14} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children} <ChevronRight size={14} />
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, detailIcon: DetailIcon, detailTone = 'muted', loading }) {
  const detailColor = {
    muted: 'text-[#70829B] dark:text-[#94A3B8]',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-[#FCD34D]',
    bad: 'text-rose-600 dark:text-[#FB7185]',
  }[detailTone];
  return (
    <div className="bg-white dark:bg-[#17191A] rounded-2xl border border-[#E1E8EF] dark:border-[#2B3238] shadow-[0_1px_3px_rgba(20,32,51,0.05)] p-4 sm:p-5 min-h-[132px] flex flex-col justify-between transition-all hover:border-[#DFFF83]/70 dark:hover:border-[#DFFF83]/40">
      <div>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-stone-100/80 dark:bg-[#1E2124] border border-stone-200/60 dark:border-[#2B3238] flex items-center justify-center shrink-0">
            <Icon size={20} strokeWidth={2} className="text-[#142033] dark:text-[#F5F7F5]" />
          </span>
          <span className="text-sm font-medium text-[#70829B] dark:text-[#94A3B8] leading-tight">{label}</span>
        </div>
        <div className="mt-3 text-2xl sm:text-[28px] font-semibold text-[#142033] dark:text-[#F5F7F5] font-heading leading-none tabular-nums">
          {loading ? <Skeleton className="h-7 w-20" /> : value}
        </div>
      </div>
      <div className={`mt-3 text-xs flex items-center gap-1.5 ${detailColor}`}>
        {loading ? (
          <Skeleton className="h-3 w-28" />
        ) : (
          <>
            {DetailIcon && <DetailIcon size={13} className="shrink-0" />}
            <span className="truncate">{detail}</span>
          </>
        )}
      </div>
    </div>
  );
}

function BatchCard({ batch, currentBirds, eggsPerDay, logsLoaded, onOpen }) {
  const eggsBatch = laysEggs(batch.type);
  const purpose = birdPurpose(batch.type);
  const placed = Number(batch.birdCount) || 0;
  const TypeIcon = eggsBatch ? EggIcon : BirdIcon;

  let metric;
  if (eggsBatch) {
    metric = {
      icon: EggIcon,
      label: 'Egg Production',
      value: !logsLoaded ? null : eggsPerDay == null ? 'None this week' : `${eggsPerDay.toLocaleString()}/day`,
    };
  } else if (purpose === 'meat') {
    metric = {
      icon: ShieldCheck,
      label: 'Survival',
      value: !logsLoaded ? null : placed ? `${round1((currentBirds / placed) * 100)}%` : '—',
    };
  } else {
    metric = { icon: CalendarIcon, label: 'Age', value: batchAge(batch) };
  }
  const MetricIcon = metric.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group bg-stone-50/70 dark:bg-[#1E2124] hover:bg-white dark:hover:bg-[#252A2E] rounded-xl border border-stone-200/80 dark:border-[#2B3238] hover:border-[#DFFF83] dark:hover:border-[#DFFF83] shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-[#DFFF83]"
    >
      {/* Individual Bird Image with sleek aspect ratio */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-200/60 dark:bg-[#17191A]">
        <img
          src={batchImage(batch)}
          alt={batch.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2.5 right-2.5">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold backdrop-blur-md shadow-xs border ${
              eggsBatch
                ? 'bg-[#EFFFC4]/95 text-[#4D6600] border-[#E3F5A8] dark:bg-[#20361C]/95 dark:text-[#DFFF83] dark:border-[#274220]'
                : 'bg-[#E2ECFB]/95 text-[#2F6FD6] border-[#DCE7F7] dark:bg-[#152B47]/95 dark:text-[#60A5FA] dark:border-[#1E395F]'
            }`}
          >
            {birdTypeLabel(batch.type)}
          </span>
        </div>
      </div>

      {/* Card Details */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <h3 className="text-sm sm:text-base font-bold text-[#142033] dark:text-[#F5F7F5] truncate group-hover:text-[#4D6600] dark:group-hover:text-[#DFFF83] transition-colors">
              {batch.name}
            </h3>
            <ChevronRight size={15} className="text-[#142033]/50 dark:text-[#94A3B8] shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>

          <div className="text-xs text-[#70829B] dark:text-[#94A3B8] mt-0.5">
            Age: <span className="font-semibold text-[#142033] dark:text-[#F5F7F5]">{batchAge(batch)}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-3 pt-3 border-t border-stone-200/70 dark:border-[#2B3238] grid grid-cols-2 gap-2 items-start">
          <div className="flex items-start gap-1.5 min-w-0">
            <BirdIcon size={14} className="mt-0.5 shrink-0 text-[#70829B] dark:text-[#94A3B8]" />
            <div className="min-w-0">
              <div className="text-[10px] text-[#70829B] dark:text-[#94A3B8]">Birds</div>
              <div className="text-xs sm:text-sm font-bold text-[#142033] dark:text-[#F5F7F5] tabular-nums truncate">
                {logsLoaded ? currentBirds.toLocaleString() : <Skeleton className="h-4 w-12 mt-1" />}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-1.5 min-w-0">
            <MetricIcon size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-[#142033] dark:text-[#F5F7F5]" />
            <div className="min-w-0">
              <div className="text-[10px] text-[#70829B] dark:text-[#94A3B8] truncate">{metric.label}</div>
              <div className="text-xs sm:text-sm font-bold text-[#142033] dark:text-[#F5F7F5] truncate">
                {metric.value ?? <Skeleton className="h-4 w-14 mt-1" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TintedIcon({ tint, icon: Icon, file, size = 18 }) {
  return (
    <span className={`w-11 h-11 ${tint} rounded-full flex items-center justify-center shrink-0 text-[#142033] dark:text-[#F5F7F5]`} aria-hidden="true">
      {file ? (
        <img src={file} alt="" style={{ width: size, height: size }} className="object-contain" />
      ) : (
        <Icon size={size} strokeWidth={1.9} />
      )}
    </span>
  );
}

const ACTIVITY_STYLE = {
  feed: { icon: FeedIcon, tint: 'bg-[#EFFFC4] dark:bg-[#1E2D1A]' },
  eggs: { icon: EggIcon, tint: 'bg-amber-50 dark:bg-[#2B210B]' },
  vaccination: { icon: VaccineIcon, tint: 'bg-[#EFFFC4] dark:bg-[#1E2D1A]' },
  mortality: { icon: BirdIcon, tint: 'bg-rose-50 dark:bg-[#2D1419]' },
  batch: { icon: PlusCircle, tint: 'bg-[#EAF1FC] dark:bg-[#172538]' },
};



function EmptyNote({ children }) {
  return <div className="flex-1 flex items-center justify-center text-center text-xs text-[#70829B] dark:text-[#94A3B8] py-8 px-4">{children}</div>;
}

// ---- page ------------------------------------------------------------------------

export function DashboardPage() {
  const navigate = useNavigate();
  const { farm } = useAuth();
  const { batches, loading: batchesLoading, error: batchesError } = useBatches();

  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const quickActionRef = useRef(null);

  // Close Quick Actions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (quickActionRef.current && !quickActionRef.current.contains(event.target)) {
        setQuickActionOpen(false);
      }
    }
    if (quickActionOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [quickActionOpen]);

  // Per-batch logs plus the farm's feed purchases, loaded in groups of two
  // batches (farmData.js: firing every request at once trips Lambda
  // concurrency limits). Completed batches only need their feed usage, which
  // still counts against the shared feed store.
  const [logsByBatch, setLogsByBatch] = useState({});
  const [purchases, setPurchases] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (batchesLoading) return undefined;
    let cancelled = false;

    async function load() {
      setLoadState((s) => (s === 'ready' ? 'ready' : 'loading'));
      const list = (p) => safe(p.then((r) => r.logs || r.entries || []), null);
      const perBatch = await inGroups(batches, BATCHES_PER_GROUP, async (b) => {
        if (!isActive(b)) {
          return [b.batchId, { mortality: [], feed: (await list(getLogs(b.batchId, 'feed'))) || [], eggs: [], vaccinations: [], schedule: [] }];
        }
        const [mortality, feed, eggs, vaccinations, schedule] = await Promise.all([
          list(getLogs(b.batchId, 'mortality')),
          list(getLogs(b.batchId, 'feed')),
          laysEggs(b.type) ? list(getLogs(b.batchId, 'eggs')) : Promise.resolve([]),
          list(getVaccinationRecords(b.batchId)),
          safe(getSchedule(b.batchId).then((r) => r.schedule || []), null),
        ]);
        return [b.batchId, { mortality, feed, eggs, vaccinations, schedule }];
      });
      const bought = await safe(getFeedPurchases(), null);
      if (cancelled) return;

      const anyLoaded = perBatch.some(([, l]) => l.mortality || l.feed || l.schedule);
      setLogsByBatch(Object.fromEntries(perBatch));
      setPurchases(bought);
      setLoadState(batches.length > 0 && !anyLoaded && bought === null ? 'error' : 'ready');
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [batches, batchesLoading, reloadKey]);

  // Anything saved elsewhere (a modal here, or another tab) refreshes the numbers.
  useEffect(() => {
    window.addEventListener(LOGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(LOGS_CHANGED_EVENT, reload);
  }, [reload]);

  const loading = batchesLoading || loadState === 'loading';
  const today = toIso(new Date());

  // Same order as the Batches page: active only here, newest first.
  const activeBatches = useMemo(
    () =>
      batches
        .filter(isActive)
        .sort((a, b) => new Date(b.startDate || b.createdAt || 0) - new Date(a.startDate || a.createdAt || 0)),
    [batches]
  );

  const currentBirdsOf = useCallback(
    (b) => {
      const mortality = logsByBatch[b.batchId]?.mortality;
      if (!mortality) return Number(b.currentBirds ?? b.birdCount) || 0;
      const lost = mortality.reduce((s, m) => s + (Number(m.count) || 0), 0);
      return Math.max(0, (Number(b.birdCount) || 0) - lost);
    },
    [logsByBatch]
  );

  // ---- summary metrics -----------------------------------------------------------
  const weekAgo = isoDaysAgo(6);
  const startedThisWeek = activeBatches.filter((b) => (b.startDate || b.createdAt || '').slice(0, 10) >= weekAgo).length;
  const totalBirds = activeBatches.reduce((s, b) => s + currentBirdsOf(b), 0);
  const lostThisWeek = activeBatches.reduce(
    (s, b) =>
      s +
      (logsByBatch[b.batchId]?.mortality || [])
        .filter((m) => m.date && m.date >= weekAgo)
        .reduce((t, m) => t + (Number(m.count) || 0), 0),
    0
  );

  const feed = useMemo(() => {
    if (purchases === null) return null;
    const usage = Object.values(logsByBatch).flatMap((l) => l.feed || []);
    const { lines } = computeFeedStock(purchases, usage);
    return {
      bought: purchases.length > 0,
      bags: lines.reduce((s, l) => s + Math.max(l.left, 0), 0),
      kg: lines.reduce((s, l) => s + Math.max(l.left, 0) * l.bagSizeKg, 0),
      low: lines.filter((l) => l.status !== 'ok').length,
    };
  }, [purchases, logsByBatch]);

  const vaccines = useMemo(() => {
    const schedules = activeBatches.flatMap((b) =>
      (logsByBatch[b.batchId]?.schedule || []).map((s) => ({ ...s, batchId: b.batchId }))
    );
    const open = schedules.filter((s) => s.dueDate && s.status !== 'done' && s.status !== 'missed');
    const upcoming = open.filter((s) => s.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const overdue = schedules.filter((s) => s.dueDate && s.status !== 'done' && (s.status === 'missed' || s.dueDate < today));
    return { upcoming, overdue: overdue.length };
  }, [activeBatches, logsByBatch, today]);

  // ---- batches -----------------------------------------------------------------
  const visibleBatches = activeBatches.slice(0, MAX_VISIBLE_BATCHES);
  const eggsPerDayOf = (b) => {
    const recent = (logsByBatch[b.batchId]?.eggs || []).filter((e) => e.date && e.date >= weekAgo);
    if (recent.length === 0) return null;
    return Math.round(recent.reduce((s, e) => s + eggCount(e), 0) / 7);
  };

  // ---- recent activity -------------------------------------------------------------
  const [activityExpanded, setActivityExpanded] = useState(false);
  const activity = useMemo(() => {
    const byId = Object.fromEntries(batches.map((b) => [b.batchId, b]));
    const items = [];
    Object.entries(logsByBatch).forEach(([batchId, l]) => {
      const b = byId[batchId];
      if (!b) return;
      const base = { batchId, closed: !isActive(b), batchName: b.name };
      (l.feed || []).forEach((e) =>
        items.push({ ...base, pending: e.pending, type: 'feed', at: e.createdAt || e.date, title: 'Feed logged', sub: `${b.name} • ${formatBags(feedBags(e))}` })
      );
      (l.eggs || []).forEach((e) =>
        items.push({ ...base, pending: e.pending, type: 'eggs', at: e.createdAt || e.date, title: 'Eggs recorded', sub: `${b.name} • ${eggCount(e).toLocaleString()} eggs` })
      );
      (l.vaccinations || []).forEach((e) =>
        items.push({ ...base, pending: e.pending, type: 'vaccination', at: e.createdAt || e.dateAdministered || e.date, title: 'Vaccination recorded', sub: `${b.name} • ${e.vaccineName || 'Vaccine'}` })
      );
      (l.mortality || []).forEach((e) =>
        items.push({ ...base, pending: e.pending, type: 'mortality', at: e.createdAt || e.date, title: 'Birds lost recorded', sub: `${b.name} • ${Number(e.count) || 0} bird${Number(e.count) === 1 ? '' : 's'}` })
      );
    });
    batches.forEach((b) =>
      items.push({ batchId: b.batchId, closed: !isActive(b), type: 'batch', at: b.createdAt || b.startDate, title: 'New batch created', sub: b.name })
    );
    return items
      .map((i) => ({ ...i, ms: Date.parse(i.at) }))
      .filter((i) => !Number.isNaN(i.ms))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, ACTIVITY_EXPANDED);
  }, [batches, logsByBatch]);
  const shownActivity = activity.slice(0, activityExpanded ? ACTIVITY_EXPANDED : ACTIVITY_COLLAPSED);

  // ---- production performance -----------------------------------------------------------
  const [perfBatchId, setPerfBatchId] = useState('');
  const perfBatch = activeBatches.find((b) => b.batchId === perfBatchId) || activeBatches[0] || null;
  const [weightByBatch, setWeightByBatch] = useState({});
  const perfNeedsWeight = perfBatch && ['meat', 'dual'].includes(birdPurpose(perfBatch.type));

  useEffect(() => {
    if (!perfNeedsWeight || weightByBatch[perfBatch.batchId] !== undefined) return undefined;
    let cancelled = false;
    getLogs(perfBatch.batchId, 'weight')
      .then((r) => r.logs || [])
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setWeightByBatch((prev) => ({ ...prev, [perfBatch.batchId]: list }));
      });
    return () => {
      cancelled = true;
    };
  }, [perfNeedsWeight, perfBatch, weightByBatch]);

  const perf =
    perfBatch && !loading
      ? buildPerformance(perfBatch, logsByBatch[perfBatch.batchId], weightByBatch[perfBatch.batchId] ?? null, currentBirdsOf(perfBatch))
      : null;

  // ---- quick actions ---------------------------------------------------------------
  const [modal, setModal] = useState(null); // 'feed' | 'feedStock' | 'vaccine' | 'lossPicker'
  const healthEvents = useMemo(
    () =>
      buildHealthEvents({
        schedules: activeBatches.flatMap((b) => (logsByBatch[b.batchId]?.schedule || []).map((s) => ({ ...s, batchId: b.batchId }))),
        records: activeBatches.flatMap((b) => (logsByBatch[b.batchId]?.vaccinations || []).map((r) => ({ ...r, batchId: b.batchId }))),
        supplements: loadSupplements(),
        batchNames: Object.fromEntries(batches.map((b) => [b.batchId, b.name])),
      }),
    [activeBatches, batches, logsByBatch]
  );

  const logBirdLoss = () => {
    if (activeBatches.length === 1) navigate(`/batches/${activeBatches[0].batchId}?log=mortality`);
    else setModal('lossPicker');
  };
  const noActive = activeBatches.length === 0;

  // Onboarding no longer creates a batch, so a farm with none at all is
  // prompted here. "Later" hides it for this browser session only.
  const [firstBatchDismissed, setFirstBatchDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(FIRST_BATCH_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const showFirstBatchPrompt = !batchesLoading && !batchesError && batches.length === 0 && !firstBatchDismissed;
  const dismissFirstBatchPrompt = () => {
    setFirstBatchDismissed(true);
    try {
      sessionStorage.setItem(FIRST_BATCH_DISMISSED_KEY, '1');
    } catch {
      // Hidden until the page reloads.
    }
  };

  const firstName = (farm?.farmerName || '').trim().split(/\s+/)[0];

  // ---- render ----------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12 text-[#142033] dark:text-[#F5F7F5]">
      {/* Greeting & Quick Action Dropdown: kept side-by-side with Quick Actions on the right across all screen sizes */}
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* Greeting text on the left */}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-[26px] font-semibold font-heading leading-tight text-[#142033] dark:text-[#F5F7F5] truncate">
            {firstName ? `Hi, ${firstName}` : 'Hi there'}
          </h1>
          <p className="text-xs sm:text-sm text-[#70829B] dark:text-[#94A3B8] mt-0.5 truncate">
            Here's what's happening on your farm today.
          </p>
        </div>

        {/* Quick Action Dropdown always on the right */}
        <div className="relative shrink-0" ref={quickActionRef}>
          <button
            type="button"
            onClick={() => setQuickActionOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-[#DFFF83] text-[#17191A] font-semibold text-xs sm:text-sm hover:bg-[#cbf260] active:scale-[0.98] transition-all shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#DFFF83]/80 shrink-0"
            aria-expanded={quickActionOpen}
            aria-haspopup="true"
          >
            <Zap size={15} strokeWidth={2.5} className="fill-[#17191A] shrink-0" />
            <span className="whitespace-nowrap">Quick Actions</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 shrink-0 ${quickActionOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {quickActionOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-[#1E2124] border border-[#E1E8EF] dark:border-[#2B3238] rounded-xl shadow-xl p-1.5 z-30 animate-slide-up text-xs"
              role="menu"
            >
              <Link
                to="/batches/new"
                onClick={() => setQuickActionOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#142033] dark:text-[#F5F7F5] hover:bg-[#F7FFE0] dark:hover:bg-[#142312] hover:text-[#4D6600] dark:hover:text-[#DFFF83] transition-colors font-medium"
              >
                <div className="w-7 h-7 rounded-full bg-[#DFFF83] text-[#17191A] flex items-center justify-center shrink-0">
                  <Plus size={15} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">Create Batch</div>
                  <div className="text-[11px] text-[#70829B] dark:text-[#94A3B8] font-normal">Start a new flock</div>
                </div>
              </Link>

              <button
                type="button"
                disabled={noActive}
                onClick={() => {
                  setQuickActionOpen(false);
                  setModal('feed');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-medium ${
                  noActive
                    ? 'opacity-40 cursor-not-allowed text-[#70829B]'
                    : 'text-[#142033] dark:text-[#F5F7F5] hover:bg-stone-50 dark:hover:bg-[#262A2E] cursor-pointer'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-stone-100 dark:bg-[#2B3238] flex items-center justify-center shrink-0">
                  <FeedIcon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">Log Feed</div>
                  <div className="text-[11px] text-[#70829B] dark:text-[#94A3B8] font-normal">
                    {noActive ? 'Needs an active batch' : 'Record feed usage'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={noActive}
                onClick={() => {
                  setQuickActionOpen(false);
                  setModal('vaccine');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-medium ${
                  noActive
                    ? 'opacity-40 cursor-not-allowed text-[#70829B]'
                    : 'text-[#142033] dark:text-[#F5F7F5] hover:bg-stone-50 dark:hover:bg-[#262A2E] cursor-pointer'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-stone-100 dark:bg-[#2B3238] flex items-center justify-center shrink-0">
                  <VaccineIcon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">Record Vaccination</div>
                  <div className="text-[11px] text-[#70829B] dark:text-[#94A3B8] font-normal">
                    {noActive ? 'Needs an active batch' : 'Update vaccination records'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={noActive}
                onClick={() => {
                  setQuickActionOpen(false);
                  logBirdLoss();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-medium ${
                  noActive
                    ? 'opacity-40 cursor-not-allowed text-[#70829B]'
                    : 'text-[#142033] dark:text-[#F5F7F5] hover:bg-rose-50 dark:hover:bg-[#260D12] hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-[#260D12] text-rose-600 flex items-center justify-center shrink-0">
                  <BirdIcon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">Log Bird Loss</div>
                  <div className="text-[11px] text-[#70829B] dark:text-[#94A3B8] font-normal">
                    {noActive ? 'Needs an active batch' : 'Record bird mortality'}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {loadState === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Some farm records could not be loaded, so a few numbers may be missing.</span>
          <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 font-semibold cursor-pointer shrink-0">
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      )}

      {/* 1. Your Batches Dedicated Rectangle Panel */}
      <section className="bg-[#f4f5f7] dark:bg-[#17191A] rounded-2xl border border-[#E1E8EF] dark:border-[#2B3238] shadow-[0_1px_3px_rgba(20,32,51,0.05)] p-4 sm:p-5 lg:p-6 transition-colors">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-[#F7FFE0] dark:bg-[#1E2124] flex items-center justify-center shrink-0">
              <BatchIcon size={18} strokeWidth={2} className="text-[#142033] dark:text-[#DFFF83]" />
            </span>
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#142033] dark:text-[#F5F7F5] font-heading truncate">
                Your Batches
              </h2>
              {activeBatches.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F7FFE0] text-[#4D6600] dark:bg-[#20361C] dark:text-[#DFFF83] border border-[#E3F5A8] dark:border-[#274220]">
                  {activeBatches.length} {activeBatches.length === 1 ? 'Active' : 'Active'}
                </span>
              )}
            </div>
          </div>
          <ViewAll to="/batches">View all batches</ViewAll>
        </div>

        {batchesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-stone-50/70 dark:bg-[#1E2124] rounded-xl border border-stone-200/80 dark:border-[#2B3238] overflow-hidden flex flex-col">
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="p-3.5 sm:p-4 space-y-2.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Skeleton className="h-8 rounded-lg" />
                    <Skeleton className="h-8 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : noActive && batchesError ? (
          // The list couldn't load (offline, nothing saved yet): not the same as having none.
          <div className="p-8 text-center border-2 border-dashed border-[#CCD7E2] dark:border-[#2B3238] rounded-xl flex flex-col items-center justify-center">
            <p className="text-sm font-semibold text-[#142033] dark:text-[#F5F7F5]">Your batches will show once you're back online</p>
            <p className="text-xs text-[#70829B] dark:text-[#94A3B8] mt-1">They haven't been saved on this device yet.</p>
          </div>
        ) : noActive ? (
          <div className="p-8 text-center border-2 border-dashed border-[#CCD7E2] dark:border-[#2B3238] rounded-xl flex flex-col items-center justify-center">
            <p className="text-sm font-semibold text-[#142033] dark:text-[#F5F7F5]">No active batches</p>
            <p className="text-xs text-[#70829B] dark:text-[#94A3B8] mt-1">Start a batch to begin tracking birds, feed and vaccinations.</p>
            <Link
              to="/batches/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#DFFF83] text-[#17191A] text-sm font-semibold hover:bg-[#C5E95A] transition-colors"
            >
              <Plus size={16} /> Create New Batch
            </Link>
          </div>
        ) : (
          <div className=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {visibleBatches.map((b) => (
              <BatchCard
                key={b.batchId}
                batch={b}
                currentBirds={currentBirdsOf(b)}
                eggsPerDay={eggsPerDayOf(b)}
                logsLoaded={!loading}
                onOpen={() => navigate(`/batches/${b.batchId}`)}
              />
            ))}
            {/* The 4th card: Create New Batch card with + sign */}
            <Link
              to="/batches/new"
              className="group bg-stone-50/50 dark:bg-[#1E2124]/40 hover:bg-stone-50 dark:hover:bg-[#1E2124] rounded-xl border-2 border-dashed border-stone-200 dark:border-[#2B3238] hover:border-[#DFFF83] dark:hover:border-[#DFFF83] shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col items-center justify-center text-center p-5 cursor-pointer min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-full bg-[#F7FFE0] dark:bg-[#252A2E] text-[#142033] dark:text-[#DFFF83] group-hover:bg-[#DFFF83] group-hover:text-[#17191A] group-hover:scale-110 flex items-center justify-center transition-all shadow-2xs mb-2.5">
                <Plus size={22} strokeWidth={2.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#142033] dark:text-[#F5F7F5] group-hover:text-[#4D6600] dark:group-hover:text-[#DFFF83] transition-colors">
                New Batch
              </span>
              <span className="text-[11px] text-[#70829B] dark:text-[#94A3B8] mt-0.5 font-medium">
                Start a new flock
              </span>
            </Link>
          </div>
        )}
      </section>

      {/* 2. Key Metrics Bento Grid */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          icon={BirdIcon}
          label="Total Birds"
          value={totalBirds.toLocaleString()}
          detail={lostThisWeek > 0 ? `${lostThisWeek.toLocaleString()} lost this week` : 'No losses this week'}
          detailIcon={lostThisWeek > 0 ? TrendingDown : null}
          detailTone={lostThisWeek > 0 ? 'bad' : 'muted'}
          loading={loading}
        />
        <SummaryCard
          icon={BatchIcon}
          label="Active Batches"
          value={activeBatches.length.toLocaleString()}
          detail={startedThisWeek > 0 ? `+${startedThisWeek} started this week` : 'No new batches this week'}
          detailIcon={startedThisWeek > 0 ? TrendingUp : null}
          detailTone={startedThisWeek > 0 ? 'good' : 'muted'}
          loading={batchesLoading}
        />
        <SummaryCard
          icon={FeedIcon}
          label="Feed Stock"
          value={feed == null || !feed.bought ? '—' : formatBags(feed.bags)}
          detail={
            feed == null
              ? 'Feed store unavailable'
              : !feed.bought
                ? 'Add feed you buy in Inventory'
                : feed.low > 0
                  ? `${Math.round(feed.kg).toLocaleString()} kg • ${feed.low} running low`
                  : `${Math.round(feed.kg).toLocaleString()} kg in store`
          }
          detailTone={feed?.low > 0 ? 'warn' : 'muted'}
          loading={loading}
        />
        <SummaryCard
          icon={VaccineIcon}
          label="Upcoming Vaccinations"
          value={vaccines.upcoming.length.toLocaleString()}
          detail={
            vaccines.upcoming.length > 0
              ? dueWhen(daysUntil(vaccines.upcoming[0].dueDate, today))
              : vaccines.overdue > 0
                ? `${vaccines.overdue} overdue`
                : 'None scheduled'
          }
          detailIcon={CalendarIcon}
          detailTone={vaccines.overdue > 0 && vaccines.upcoming.length === 0 ? 'bad' : 'muted'}
          loading={loading}
        />
      </div>

      {/* 3. Deep Operations Bento Grid (Production Performance & Recent Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <Card className="p-4 sm:p-5 flex flex-col lg:col-span-7 xl:col-span-8">
            <SectionHeader
              icon={ChartLine}
              title="Production Performance"
              action={
                activeBatches.length > 0 && (
                  <label className="relative shrink-0">
                    <span className="sr-only">Choose batch</span>
                    <select
                      value={perfBatch?.batchId || ''}
                      onChange={(e) => setPerfBatchId(e.target.value)}
                      className="appearance-none bg-transparent pr-5 pl-1 py-1 text-xs font-medium text-[#142033] dark:text-[#F5F7F5] cursor-pointer max-w-[130px] truncate focus:outline-none focus:ring-2 focus:ring-[#DFFF83]/70 rounded-md"
                    >
                      {activeBatches.map((b) => (
                        <option key={b.batchId} value={b.batchId} className="bg-white dark:bg-[#17191A] text-stone-900 dark:text-[#F5F7F5]">{b.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#142033]/70 dark:text-[#94A3B8]" />
                  </label>
                )
              }
            />
            {noActive ? (
              <EmptyNote>Performance appears once you have an active batch.</EmptyNote>
            ) : !perf || perf.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-36 rounded-md" />
              </div>
            ) : perf.empty ? (
              <>
                <div className="text-xs font-medium text-[#70829B] dark:text-[#94A3B8] mb-1">{perf.title}</div>
                <EmptyNote>{perf.empty}</EmptyNote>
              </>
            ) : (
              <>
                <div className="rounded-md bg-[#F7F9FA] dark:bg-[#1E2124] px-4 py-3 transition-colors">
                  <div className="text-xs font-medium text-[#142033] dark:text-[#F5F7F5]">
                    {perf.title} <span className="text-[#70829B] dark:text-[#94A3B8] font-normal">• {perf.caption}</span>
                  </div>
                  <div className="flex items-end justify-between gap-3 mt-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[26px] font-semibold font-heading leading-none tabular-nums text-[#142033] dark:text-[#F5F7F5]">{perf.value}</span>
                      <span className="text-sm text-[#70829B] dark:text-[#94A3B8]">{perf.suffix}</span>
                    </div>
                    {perf.change && (
                      <span className={`inline-flex items-center gap-1 text-[11px] ${perf.change.up ? 'text-[#4D6600] dark:text-[#DFFF83]' : 'text-rose-600 dark:text-[#FB7185]'}`}>
                        {perf.change.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {perf.change.text}
                      </span>
                    )}
                  </div>
                  {perf.extras?.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#70829B] dark:text-[#94A3B8]">
                      {perf.extras.map((x) => (
                        <span key={x.label}>
                          {x.label}: <strong className="font-semibold text-[#142033] dark:text-[#F5F7F5]">{x.value}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  {perf.points ? (
                    <LineChart points={perf.points} formatTick={perf.formatTick} />
                  ) : (
                    <EmptyNote>{perf.thin}</EmptyNote>
                  )}
                </div>
              </>
            )}
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col lg:col-span-5 xl:col-span-4">
            <SectionHeader
              icon={HistoryIcon}
              title="Recent Activity"
              action={
                activity.length > ACTIVITY_COLLAPSED && (
                  <ViewAll onClick={() => setActivityExpanded((v) => !v)}>
                    {activityExpanded ? 'Show less' : 'View all'}
                  </ViewAll>
                )
              }
            />
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-11 h-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shownActivity.length === 0 ? (
              <EmptyNote>No activity logged yet.</EmptyNote>
            ) : (
              <ul className="divide-y divide-[#E1E8EF] dark:divide-[#2B3238] transition-colors">
                {shownActivity.map((item, i) => {
                  const style = ACTIVITY_STYLE[item.type] || { icon: Clock, tint: 'bg-stone-100 dark:bg-[#252A2E]' };
                  return (
                    <li key={`${item.type}-${item.batchId}-${item.ms}-${i}`}>
                      <Link
                        to={item.closed ? `/history/${item.batchId}` : `/batches/${item.batchId}`}
                        className="flex items-center gap-3 py-3 group"
                      >
                        <TintedIcon tint={style.tint} icon={style.icon} size={18} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold truncate text-[#142033] dark:text-[#F5F7F5]">{item.title}</span>
                            {item.pending && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-[#261B06] border border-amber-200 dark:border-[#4A350C] text-[10px] font-semibold text-amber-800 dark:text-[#FCD34D]">
                                Waiting to send
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#70829B] dark:text-[#94A3B8] truncate">{item.sub}</div>
                          <div className="text-[11px] text-[#70829B]/90 dark:text-[#94A3B8]/80 truncate">{stamp(item.at)}</div>
                        </div>
                        <ChevronRight size={16} className="text-[#70829B] dark:text-[#94A3B8] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
      </div>

      {/* Existing logging flows, reused as-is */}
      <FeedUsageModal
        isOpen={modal === 'feed'}
        onClose={() => setModal(null)}
        onAddStock={() => setModal('feedStock')}
      />
      <FeedPurchaseModal
        isOpen={modal === 'feedStock'}
        onClose={() => setModal('feed')}
        onSaved={reload}
      />
      <VaccinationModal
        isOpen={modal === 'vaccine'}
        onClose={() => setModal(null)}
        // A recorded vaccination is a log entry and already fires the
        // logs-changed refresh; a scheduled one is not, so reload for it here.
        onSaved={({ mode }) => mode === 'schedule' && reload()}
        batches={activeBatches}
        events={healthEvents}
        prefill={RECORD_PREFILL}
      />

      {/* First visit after onboarding: nudge towards the first batch. */}
      <Modal
        open={showFirstBatchPrompt}
        title="Create your first batch"
        onClose={dismissFirstBatchPrompt}
        actions={
          <>
            <button
              type="button"
              onClick={dismissFirstBatchPrompt}
              className="px-4 py-2 rounded-md text-sm font-semibold text-[#70829B] hover:text-[#142033] cursor-pointer"
            >
              Later
            </button>
            <Link
              to="/batches/new"
              onClick={dismissFirstBatchPrompt}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#DFFF83] hover:bg-[#C5E95A] text-[#17191A] text-sm font-semibold transition-colors"
            >
              <Plus size={16} /> Create batch
            </Link>
          </>
        }
      >
        <p>
          Your farm is set up. A batch is one group of birds you raise together, for example the 500 layers you
          placed this month.
        </p>
        <p className="mt-2">
          Create your first batch to start recording feed, eggs, vaccinations and bird losses.
        </p>
      </Modal>

      {/* Bird loss is recorded on the batch page's own form; this only picks the batch. */}
      <Modal open={modal === 'lossPicker'} title="Log bird loss for which batch?" onClose={() => setModal(null)}>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {activeBatches.map((b) => (
            <button
              key={b.batchId}
              type="button"
              onClick={() => {
                setModal(null);
                navigate(`/batches/${b.batchId}?log=mortality`);
              }}
              className="w-full flex items-center justify-between gap-3 rounded-md border border-[#E1E8EF] dark:border-[#2B3238] bg-white dark:bg-[#1E2124] px-4 py-3 text-left hover:border-[#B7DA3E] hover:bg-[#F7FFE0] dark:hover:bg-[#142312] dark:hover:border-[#274220] transition-colors cursor-pointer"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#142033] dark:text-[#F5F7F5] truncate">{b.name}</span>
                <span className="block text-xs text-[#70829B] dark:text-[#94A3B8]">
                  {birdTypeLabel(b.type)} • {currentBirdsOf(b).toLocaleString()} birds
                </span>
              </span>
              <ChevronRight size={16} className="text-[#70829B] dark:text-[#94A3B8] shrink-0" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default DashboardPage;
