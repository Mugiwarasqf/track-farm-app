import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Activity,
  CheckCircle2,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  ShoppingCart,
  Download,
  Flag,
  RotateCcw,
  Stethoscope,
  ClipboardList,
  MoreHorizontal,
} from 'lucide-react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useBatches } from '../context/BatchContext';
import { useAuth } from '../context/AuthContext';
import { CompleteBatchModal } from '../components/ui/CompleteBatchModal';
import { SaleModal } from '../components/ui/SaleModal';
import { createSale } from '../api/sales';
import { SickBayTab } from '../components/sickbay/SickBayTab';
import { penForBatch } from '../lib/pens';
import { getLogs, createLog } from '../api/logs';
import { QUEUED_SAVE_MESSAGE } from '../lib/offlineQueue';
import { getSchedule } from '../api/schedule';
import { getVaccinationRecords } from '../api/vaccinations';
import { SupplementModal } from '../components/ui/SupplementModal';
import { CalendarPicker } from '../components/ui/CalendarPicker';
import { buildHealthEvents } from '../lib/healthEvents';
import { ROUTES } from '../lib/vaccines';
import { useSupplements, describeDose, findSupplementType, toIso } from '../lib/supplements';
import { Sheet, FIELD, LABEL, PRIMARY_BUTTON } from '../components/ui/Sheet';
import { LogTodayModal } from '../components/ui/LogTodayModal';
import { Spinner } from '../components/ui/Spinner';
import { LineChart } from '../components/ui/LineChart';
import { buildPerformance } from '../lib/production';
import { VaccinationModal } from '../components/ui/VaccinationModal';
import { DeleteBatchModal } from '../components/ui/DeleteBatchModal';
import { useToast } from '../components/ui/Toast';
import { PillIcon } from '../components/ui/PillIcon';
import { BirdIcon } from '../components/ui/BirdIcon';
import { EGGS_PER_CRATE, FEED_BAG_KG, batchAge, batchImage, computeFCR, daysActive, feedBags, formatBags, formatCrates, formatDate, typePillClass, birdTypeLabel, birdPurpose, laysEggs } from '../lib/batch';
import { downloadTableReport } from '../lib/report';
import { FeedUsageModal } from '../components/ui/FeedUsageModal';
import { FeedPurchaseModal } from '../components/ui/FeedPurchaseModal';
import { VaccineIcon } from '../components/ui/VaccineIcon';
import { FeedIcon } from '../components/ui/FeedIcon';
import { EggIcon } from '../components/ui/EggIcon';
import { WeightIcon } from '../components/ui/WeightIcon';
import { PenIcon } from '../components/ui/PenIcon';
import { CalendarIcon } from '../components/ui/CalendarIcon';

const TABS = [
  { id: 'records', label: 'Records' },
  { id: 'health', label: 'Health' },
  { id: 'feed', label: 'Feed' },
  { id: 'summary', label: 'Summary' },
];

// Which download each tab offers.
const TAB_REPORT = { records: 'logs', health: 'vaccines', feed: 'feed', summary: 'overview' };

function TopTile({ label, value, note, tone = 'plain', onClick, action }) {
  const tones = {
    plain: 'text-stone-950 dark:text-[#F5F7F5]',
    good: 'text-[#4D6600] dark:text-[#DFFF83]',
    warn: 'text-amber-700 dark:text-amber-400',
    bad: 'text-rose-600 dark:text-rose-400',
  };
  const Box = onClick ? 'button' : 'div';
  return (
    <Box
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`text-left rounded-2xl bg-white dark:bg-[#1E2124] border border-stone-200 dark:border-[#2B3238] p-4 shadow-sm flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:border-stone-300 dark:hover:border-[#374151]' : ''}`}
    >
      <span className="text-sm text-stone-500 dark:text-[#94A3B8]">{label}</span>
      <span className={`text-xl font-bold font-heading leading-tight break-words ${tones[tone]}`}>{value}</span>
      {note && <span className={`text-sm ${tone === 'bad' ? tones.bad : 'text-stone-500 dark:text-[#94A3B8]'}`}>{note}</span>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 h-11 rounded-xl border border-[#D2EC7A] dark:border-[#B7DA3E]/40 text-sm font-semibold text-[#4D6600] dark:text-[#DFFF83] hover:bg-[#F7FFE0] dark:hover:bg-[#252A2E] transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </Box>
  );
}

function StatRow({ label, value, note }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-stone-100 dark:border-[#2B3238] last:border-0">
      <div className="min-w-0">
        <div className="text-base text-stone-700 dark:text-[#94A3B8]">{label}</div>
        {note && <div className="text-sm text-stone-400 dark:text-[#64748B]">{note}</div>}
      </div>
      <span className="text-base font-semibold text-stone-950 dark:text-[#F5F7F5] shrink-0 text-right">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-[#2B3238] bg-stone-50/60 dark:bg-[#17191A] p-6 flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-white dark:bg-[#1E2124] border border-stone-200 dark:border-[#2B3238] flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={2.5} className="text-stone-400 dark:text-[#64748B]" />
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold text-stone-800 dark:text-[#F5F7F5]">{title}</div>
        {description && <div className="text-sm text-stone-500 dark:text-[#94A3B8] mt-0.5">{description}</div>}
      </div>
    </div>
  );
}

function LogRow({ icon: Icon, primary, secondary, value, pending }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-stone-100 dark:border-[#2B3238] last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-[#2B3238] flex items-center justify-center shrink-0">
            <Icon size={16} strokeWidth={2.5} className="text-stone-600 dark:text-[#94A3B8]" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-semibold text-stone-900 dark:text-[#F5F7F5] truncate">{primary}</span>
            {pending && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-[#261B06] border border-amber-200 dark:border-[#4A350C] text-xs font-semibold text-amber-800 dark:text-[#FCD34D]">
                Waiting to send
              </span>
            )}
          </div>
          {secondary && <div className="text-sm text-stone-500 dark:text-[#94A3B8] truncate mt-0.5">{secondary}</div>}
        </div>
      </div>
      {value && <span className="text-sm font-semibold text-stone-900 dark:text-[#F5F7F5] shrink-0 text-right">{value}</span>}
    </div>
  );
}

export function BatchDetailPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { batches, selectBatch, deleteBatch, updateBatch } = useBatches();
  const { farm } = useAuth();
  const toast = useToast();

  const batch = batches.find(b => b.batchId === batchId) || null;

  const [activeTab, setActiveTab] = useState('records');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  // Bumped by the "Isolate Birds" quick action to open the sick bay form.
  const [sickBaySignal, setSickBaySignal] = useState(0);

  // Batch specific logs state
  const [mortalityLogs, setMortalityLogs] = useState([]);
  const [feedLogs, setFeedLogs] = useState([]);
  const [eggLogs, setEggLogs] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [scheduleList, setScheduleList] = useState([]);
  const [vaccRecords, setVaccRecords] = useState([]);
  const [allSupplements, setAllSupplements] = useSupplements();
  const multivitaminLogs = allSupplements.filter((s) => s.batchId === batchId);
  const [vacPrefill, setVacPrefill] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => toIso(new Date()));

  // Modal states for logging
  const [logModal, setLogModal] = useState(null); // 'mortality' | 'feed' | 'eggs' | 'vaccine' | 'multivitamin'
  // True while a bird loss / eggs / weight entry is being saved.
  const [savingLog, setSavingLog] = useState(false);
  const savingLogRef = useRef(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));

  // Form fields
  const [avgWeightKg, setAvgWeightKg] = useState('');
  const [weightSampleSize, setWeightSampleSize] = useState('');

  // The dashboard's "Log Bird Loss" quick action lands here with ?log=mortality
  // so it opens this page's own mortality form rather than a copy of it. The
  // param is cleared straight away so a refresh or back-navigation doesn't
  // reopen the form. Completed batches never open it.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLog = searchParams.get('log');
  useEffect(() => {
    if (!requestedLog || !batch) return;
    if (requestedLog === 'mortality' && batch.status !== 'closed') {
      setLogModal('today');
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('log');
      return next;
    }, { replace: true });
  }, [requestedLog, batch, setSearchParams]);

  useEffect(() => {
    if (!batchId) return;
    selectBatch(batchId);
    let cancelled = false;

    async function loadBatchData() {
      setLoading(true);
      try {
        const [mRes, fRes, sRes, eRes, vRes, wRes] = await Promise.all([
          getLogs(batchId, 'mortality').catch(() => ({ logs: [], entries: [] })),
          getLogs(batchId, 'feed').catch(() => ({ logs: [], entries: [] })),
          getSchedule(batchId).catch(() => ({ schedule: [] })),
          getLogs(batchId, 'eggs').catch(() => ({ logs: [], entries: [] })),
          getVaccinationRecords(batchId).catch(() => ({ logs: [] })),
          getLogs(batchId, 'weight').catch(() => ({ logs: [], entries: [] })),
        ]);

        if (!cancelled) {
          const mList = mRes?.logs || mRes?.entries || [];
          const fList = fRes?.logs || fRes?.entries || [];
          const eList = eRes?.logs || eRes?.entries || [];
          const wList = wRes?.logs || wRes?.entries || [];
          setMortalityLogs(mList);
          setFeedLogs(fList);
          setScheduleList(sRes?.schedule || []);
          setEggLogs(eList);
          setVaccRecords(vRes?.logs || []);
          setWeightLogs(wList);
        }
      } catch (err) {
        console.error('Error loading batch data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBatchData();
    return () => { cancelled = true; };
  }, [batchId, batch?.type, selectBatch]);

  if (!batch) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-stone-900 font-heading">Batch Not Found</h2>
        <p className="text-sm text-stone-500">The requested batch could not be found or has been removed.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DFFF83] text-[#17191A] rounded-xl text-xs font-semibold"
        >
          <ChevronLeft size={16} /> Return to Home
        </Link>
      </div>
    );
  }

  const totalMortality = mortalityLogs.reduce((acc, curr) => acc + (curr.count || 0), 0);
  const currentBirds = Math.max(0, (batch.birdCount || 0) - totalMortality - (Number(batch.birdsSoldToDate) || 0));
  const totalFeedBags = feedLogs.reduce((acc, curr) => acc + feedBags(curr), 0);
  // null until there are 2+ weight samples to compute a gain from — see
  // lib/batch.js's computeFCR for why, and the approximation it makes.
  const fcr = computeFCR(feedLogs, weightLogs, currentBirds);

  // Weigh-ins oldest → newest, each with its change from the one before.
  const weightHistory = [...weightLogs]
    .filter((w) => w.date && Number(w.averageWeightKg) > 0)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''))
    .map((w, i, list) => ({
      ...w,
      change: i === 0 ? null : Number(w.averageWeightKg) - Number(list[i - 1].averageWeightKg),
    }));
  const firstWeight = weightHistory[0];
  const latestWeight = weightHistory[weightHistory.length - 1];
  const weightGain = weightHistory.length > 1 ? Number(latestWeight.averageWeightKg) - Number(firstWeight.averageWeightKg) : null;
  const formatKg = (kg) => `${Math.round(Number(kg) * 1000) / 1000} kg`;

  // Feed conversion ratio as shown everywhere on this page: the value, or
  // the actual reason it can't be worked out yet.
  const fcrValue = fcr != null ? `${fcr} kg` : '-';
  const fcrNote =
    fcr != null
      ? 'Feed eaten for each kg the birds gained'
      : weightHistory.length < 2
      ? 'Log 2 weigh-ins (More, then Log bird weight)'
      : !(weightGain > 0)
      ? 'Birds have not gained weight between weigh-ins'
      : feedLogs.length === 0
      ? 'Record feed usage to work it out'
      : 'Not enough data yet';
  const formatChange = (kg) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${formatKg(Math.abs(kg))}`;

  // Handlers for logging
  const handleLogWeight = async (e) => {
    e.preventDefault();
    if (!logDate) return toast('Please pick a date', 'error');
    if (logDate > todayIso) return toast("You can't record something for a future date", 'error');
    if (!avgWeightKg || Number(avgWeightKg) <= 0) return toast('Enter the average bird weight', 'error');
    // One save at a time: a second press while this one is in flight would
    // create a duplicate entry.
    if (savingLogRef.current) return;
    savingLogRef.current = true;
    setSavingLog(true);
    try {
      const createdItem = await createLog(batchId, 'weight', {
        date: logDate,
        averageWeightKg: Number(avgWeightKg),
        sampleSize: weightSampleSize ? Number(weightSampleSize) : undefined,
      });
      if (createdItem?.queued) {
        toast(QUEUED_SAVE_MESSAGE, 'success');
        setWeightLogs([createdItem, ...weightLogs]);
      } else {
        toast('Weight sample recorded', 'success');
        const res = await getLogs(batchId, 'weight');
        const items = res?.logs || res?.entries || (createdItem ? [createdItem, ...weightLogs] : weightLogs);
        setWeightLogs(items);
      }
      setAvgWeightKg('');
      setWeightSampleSize('');
      setLogModal(null);
    } catch (err) {
      toast(err.message || 'Failed to record weight', 'error');
    } finally {
      savingLogRef.current = false;
      setSavingLog(false);
    }
  };

  const openVaccination = (prefill = null) => {
    setVacPrefill(prefill);
    setLogModal('vaccine');
  };

  // Put what the vaccination form saved straight into the lists.
  const handleVaccinationSaved = ({ mode, item, scheduleId }) => {
    if (mode === 'schedule') {
      setScheduleList((prev) => [...prev, item]);
      return;
    }
    setVaccRecords((prev) => [item, ...prev]);
    if (scheduleId) {
      setScheduleList((prev) => prev.map((s) => (s.scheduleId === scheduleId ? { ...s, status: 'done' } : s)));
    }
  };

  const recordScheduled = (item) =>
    openVaccination({
      mode: 'record',
      vaccineName: item.vaccineName,
      doseNumber: item.doseNumber,
      scheduleId: item.scheduleId,
      date: toIso(new Date()),
    });

  const handleDeleteBatch = async (id) => {
    await deleteBatch(id);
    toast(`Batch "${batch?.name || 'Batch'}" was permanently deleted.`, 'success');
    navigate('/dashboard');
  };

  const handleCompleteBatch = async (updates) => {
    // The final sale goes into Sales like any other, so Income & Expenses sees it.
    const { salesRevenueNaira, ...rest } = updates;
    if (rest.birdsSold > 0) {
      await createSale({ date: todayIso, product: 'birds', batchId, quantity: rest.birdsSold, amountNaira: salesRevenueNaira || 0 });
    }
    await updateBatch(batchId, rest);
    toast(`${batch.name} is complete. You'll find it in History.`, 'success');
  };

  const handleReopen = async () => {
    try {
      await updateBatch(batchId, { status: 'active' });
      toast(`${batch.name} is active again`, 'success');
    } catch (err) {
      toast(err.message || 'Could not reopen the batch', 'error');
    }
  };

  // A sick-bay death is written to mortality; pull the list again so the
  // bird counts on this page update.
  const refreshMortality = async () => {
    try {
      const res = await getLogs(batchId, 'mortality');
      setMortalityLogs(res?.logs || res?.entries || []);
    } catch {
      // Next page load will pick it up.
    }
  };

  const batchType = (batch?.type || '').toLowerCase();
  const isLayer = laysEggs(batchType);
  const purpose = birdPurpose(batchType);
  const batchPen = penForBatch(batch, farm?.pens || []);

  const totalEggs = eggLogs.reduce((sum, e) => sum + (Number(e.crates) || 0) * EGGS_PER_CRATE + (Number(e.looseEggs) || 0), 0);
  const totalFeedCost = feedLogs.reduce((sum, e) => sum + (Number(e.costNaira) || 0), 0);
  const closedDays = daysActive(batch.startDate, batch.closedAt);
  const runningDays = batch.startDate
    ? Math.max(0, Math.round((Date.now() - new Date(batch.startDate)) / 86400000))
    : null;
  const activeDays = closedDays != null ? closedDays : runningDays;
  const lossPercent = batch.birdCount ? Math.round((totalMortality / batch.birdCount) * 1000) / 10 : null;
  const avgEggsPerDay = isLayer && activeDays ? Math.round(totalEggs / activeDays) : null;

  // Vaccination: the plan (schedule) and what was actually given (records).
  const todayIso = toIso(new Date());
  const linkedScheduleIds = new Set(vaccRecords.map((r) => r.scheduleId).filter(Boolean));
  const dueVaccines = scheduleList
    .filter((s) => s.status === 'upcoming' || s.status === 'missed')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  // History = records, plus schedules marked done before recording existed.
  const vaccinationHistory = [
    ...vaccRecords.map((r) => ({
      key: `r-${r.entryId}`,
      date: r.dateAdministered,
      vaccineName: r.vaccineName,
      doseNumber: r.doseNumber,
      route: r.route,
      birds: r.birdsVaccinated,
      administeredBy: r.administeredBy,
      lotNumber: r.lotNumber,
      pending: r.pending,
    })),
    ...scheduleList
      .filter((s) => s.status === 'done' && !linkedScheduleIds.has(s.scheduleId))
      .map((s) => ({ key: `s-${s.scheduleId}`, date: s.dueDate, vaccineName: s.vaccineName, doseNumber: s.doseNumber, route: s.route })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const doneVaccinations = vaccinationHistory.length;
  const healthEvents = buildHealthEvents({
    schedules: scheduleList.map((s) => ({ ...s, batchId })),
    records: vaccRecords.map((r) => ({ ...r, batchId })),
    supplements: multivitaminLogs,
  });

  // Best single day of egg collection, grouping entries logged on the same date.
  const eggsByDay = eggLogs.reduce((map, entry) => {
    if (!entry.date) return map;
    const eggs = (Number(entry.crates) || 0) * EGGS_PER_CRATE + (Number(entry.looseEggs) || 0);
    map.set(entry.date, (map.get(entry.date) || 0) + eggs);
    return map;
  }, new Map());
  const peakEggDay = eggsByDay.size > 0 ? Math.max(...eggsByDay.values()) : null;

  // Every log type merged for the Daily Logs tab, newest first.
  const dailyLogs = [
    ...feedLogs.map((e) => ({ pending: e.pending, date: e.date, kind: 'Feed logged', detail: `${e.feedType || 'Feed'} - ${formatBags(feedBags(e))}`, icon: FeedIcon })),
    ...mortalityLogs.map((e) => ({ pending: e.pending, date: e.date, kind: 'Mortality recorded', detail: `${Number(e.count) || 0} birds${e.note ? ` (${e.note})` : ''}`, icon: TrendingDown })),
    ...weightHistory.map((w) => ({ pending: w.pending, date: w.date, kind: 'Weight recorded', detail: `${formatKg(w.averageWeightKg)} average${w.sampleSize ? ` (${w.sampleSize} birds weighed)` : ''}`, icon: WeightIcon })),
    ...eggLogs.map((e) => ({ pending: e.pending, date: e.date, kind: 'Eggs recorded', detail: `${Number(e.crates) || 0} crates, ${Number(e.looseEggs) || 0} loose`, icon: EggIcon })),
    ...multivitaminLogs.map((m) => ({ date: m.date, kind: `${findSupplementType(m.type)?.label || 'Vitamin'} given`, detail: [m.product, describeDose(m)].filter(Boolean).join(' - '), icon: PillIcon })),
    ...vaccinationHistory.map((v) => ({ pending: v.pending, date: v.date, kind: 'Vaccination given', detail: [v.vaccineName, v.doseNumber, ROUTES[v.route]?.label].filter(Boolean).join(' - '), icon: VaccineIcon })),
    ...dueVaccines.map((s) => ({ date: s.dueDate, kind: 'Vaccination due', detail: [s.vaccineName, s.doseNumber].filter(Boolean).join(' - '), icon: VaccineIcon })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const closed = batch.status === 'closed';

  // Running costs, passed to the Complete Batch form to work out profit.
  const vaccineCost = vaccRecords.reduce((sum, r) => sum + (Number(r.costNaira) || 0), 0);
  const supplementCost = multivitaminLogs.reduce((sum, m) => sum + (Number(m.costNaira) || 0), 0);
  const costs = {
    birds: Number(batch.purchaseCostNaira) || 0,
    feed: totalFeedCost,
    vaccines: vaccineCost,
    supplements: supplementCost,
  };

  // Production trend: the same plain chart as the dashboard (lib/production.js),
  // eggs for layers, weigh-ins for meat birds, birds alive otherwise. No rating.
  const production = buildPerformance(
    batch,
    { eggs: isLayer ? eggLogs : [], feed: feedLogs, mortality: mortalityLogs },
    weightLogs,
    currentBirds
  );
  const productionTitle = { eggs: 'Egg collection', weight: 'Growth', alive: 'Flock size' }[production.kind];
  const safeName = (batch.name || 'batch').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  // Each tab exports the rows it is showing, so the file always matches what
  // is on screen. `heading` is the title printed at the top of the PDF.
  const REPORTS = {
    overview: {
      title: 'Download Batch Report',
      subtitle: 'Get a complete summary of this batch',
      build: () => ({
        heading: 'Batch Summary',
        filename: safeName + '-summary.pdf',
        headers: ['Item', 'Value'],
        rows: [
          ['Batch', batch.name],
          ['Bird type', birdTypeLabel(batchType)],
          ['Status', closed ? 'Completed' : 'Active'],
          ['Started', formatDate(batch.startDate)],
          ['Closed', batch.closedAt ? formatDate(batch.closedAt) : '-'],
          ['Age', batchAge(batch)],
          ['Total birds placed', Number(batch.birdCount || 0).toLocaleString()],
          ['Birds remaining', currentBirds.toLocaleString()],
          ['Mortality', `${totalMortality.toLocaleString()} birds`],
          ['Days active', activeDays == null ? '-' : activeDays],
          ['Total feed used', formatBags(totalFeedBags)],
          ['Total feed cost (NGN)', totalFeedCost.toLocaleString()],
          ...(isLayer ? [['Total eggs collected', `${totalEggs.toLocaleString()} (${formatCrates(totalEggs)})`]] : []),
          ['Vaccinations done', doneVaccinations],
        ],
      }),
    },
    logs: {
      title: 'Download Daily Logs Report',
      subtitle: 'Every entry recorded for this batch',
      build: () => ({
        heading: 'Daily Logs',
        filename: safeName + '-daily-logs.pdf',
        headers: ['Date', 'Type', 'Detail'],
        rows: dailyLogs.map((item) => [formatDate(item.date), item.kind, item.detail]),
      }),
    },
    feed: {
      title: 'Download Feed Report',
      subtitle: 'All feed recorded for this batch',
      build: () => ({
        heading: 'Feed Record',
        filename: safeName + '-feed.pdf',
        headers: ['Date', 'Feed type', 'Bags', 'Bag size', 'Cost (NGN)'],
        rows: feedLogs.map((e) => [
          formatDate(e.date),
          e.feedType || '',
          formatBags(feedBags(e)),
          `${Number(e.bagSizeKg) || FEED_BAG_KG}kg`,
          (Number(e.costNaira) || 0).toLocaleString(),
        ]),
      }),
    },
    vaccines: {
      title: 'Download Vaccination Report',
      subtitle: 'Vaccinations given and still due',
      build: () => ({
        heading: 'Vaccinations',
        filename: safeName + '-vaccinations.pdf',
        headers: ['Date', 'Vaccine', 'Dose', 'Method', 'Birds', 'Given by', 'Status'],
        rows: [
          ...vaccinationHistory.map((v) => [
            formatDate(v.date),
            v.vaccineName || '',
            v.doseNumber || '-',
            ROUTES[v.route]?.label || '-',
            v.birds ? Number(v.birds).toLocaleString() : '-',
            v.administeredBy || '-',
            'Given',
          ]),
          ...dueVaccines.map((s) => [
            formatDate(s.dueDate),
            s.vaccineName || '',
            s.doseNumber || '-',
            ROUTES[s.route]?.label || '-',
            s.birdsToVaccinate ? Number(s.birdsToVaccinate).toLocaleString() : '-',
            '-',
            s.dueDate < todayIso || s.status === 'missed' ? 'Overdue' : 'Due',
          ]),
        ],
      }),
    },
  };

  const report = REPORTS[TAB_REPORT[activeTab]] || REPORTS.overview;
  const handleDownload = async () => {
    const built = report.build();
    if (built.rows.length === 0) return toast('There is nothing to download on this tab yet', 'error');
    try {
      await downloadTableReport({
        filename: built.filename,
        title: built.heading,
        subtitle: `${batch.name} (${birdTypeLabel(batchType)})`,
        headers: built.headers,
        rows: built.rows,
      });
      toast('Report downloaded', 'success');
    } catch (err) {
      console.error('Report generation failed:', err);
      toast('Could not create the report. Please try again.', 'error');
    }
  };

  // ---- top of page: the three things a farmer checks first ----
  const loggedToday = [feedLogs, eggLogs, mortalityLogs, weightLogs].some((list) => list.some((e) => e.date === todayIso));
  const weekAgoIso = toIso(new Date(Date.now() - 6 * 86400000));
  const deathsThisWeek = mortalityLogs.filter((m) => m.date && m.date >= weekAgoIso).reduce((s, m) => s + (Number(m.count) || 0), 0);
  const nextVaccine = dueVaccines[0] || null;
  const nextOverdue = nextVaccine && (nextVaccine.status === 'missed' || nextVaccine.dueDate < todayIso);
  const daysUntil = nextVaccine ? Math.round((new Date(`${nextVaccine.dueDate}T00:00:00`) - new Date(`${todayIso}T00:00:00`)) / 86400000) : null;
  const nextWhen = !nextVaccine ? '' : nextOverdue ? `Overdue since ${formatDate(nextVaccine.dueDate)}` : daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due ${formatDate(nextVaccine.dueDate)}`;

  const refetch = async (resource) => {
    const setters = { eggs: setEggLogs, mortality: setMortalityLogs, feed: setFeedLogs, weight: setWeightLogs };
    try {
      const res = await getLogs(batchId, resource);
      setters[resource]?.(res?.logs || res?.entries || []);
    } catch {
      // Next page load picks it up.
    }
  };

  const moreActions = [
    { icon: FeedIcon, label: 'Log feed only', onClick: () => setLogModal('feed') },
    { icon: WeightIcon, label: 'Log bird weight', onClick: () => setLogModal('weight') },
    { icon: VaccineIcon, label: 'Record vaccination', onClick: () => openVaccination({ mode: 'record' }) },
    { icon: CalendarIcon, label: 'Schedule a vaccination', onClick: () => openVaccination({ mode: 'schedule' }) },
    { icon: PillIcon, label: 'Record vitamin or dewormer', onClick: () => setLogModal('multivitamin') },
    { icon: Stethoscope, label: 'Isolate sick birds', onClick: () => { setActiveTab('health'); setSickBaySignal((n) => n + 1); } },
  ];

  const card = 'bg-white dark:bg-[#1E2124] rounded-2xl shadow-sm p-5 border border-transparent dark:border-[#2B3238]';
  const h2 = 'text-lg font-bold text-stone-950 dark:text-[#F5F7F5] font-heading';
  const linkButton = 'inline-flex items-center gap-1.5 h-11 px-2 text-sm font-semibold text-[#4D6600] dark:text-[#DFFF83] hover:underline cursor-pointer';

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-5">
      <Link
        to="/batches"
        className="inline-flex items-center gap-2 h-11 text-base font-medium text-stone-500 dark:text-[#94A3B8] hover:text-stone-900 dark:hover:text-[#F5F7F5] transition-colors"
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
        <span>Back to Batches</span>
      </Link>

      {/* Header */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <img src={batchImage(batch)} alt={batch.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-stone-100 dark:bg-[#2B3238] shrink-0" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-stone-950 dark:text-[#F5F7F5] font-heading truncate">{batch.name}</h1>
                <span className={typePillClass(batchType)}>{birdTypeLabel(batchType)}</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1 ${
                    closed
                      ? 'bg-[#F7FFE0] dark:bg-[#DFFF83]/10 text-[#4D6600] dark:text-[#DFFF83] border-[#E3F5A8] dark:border-[#DFFF83]/30'
                      : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900'
                  }`}
                >
                  {closed && <CheckCircle2 size={12} strokeWidth={3} />}
                  {closed ? 'Completed' : 'Active'}
                </span>
              </div>
              <div className="text-sm text-stone-600 dark:text-[#94A3B8] space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={14} strokeWidth={2.5} className="shrink-0" />
                  {formatDate(batch.startDate)} – {batch.closedAt ? formatDate(batch.closedAt) : 'ongoing'}
                  {activeDays != null && ` · day ${activeDays}`}
                </div>
                <div className="flex items-center gap-1.5">
                  <PenIcon size={14} className="shrink-0" />
                  {batchPen?.name || batch.housing || 'No pen recorded'} · {Number(batch.birdCount || 0).toLocaleString()} placed
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {closed ? (
              <button
                type="button"
                onClick={handleReopen}
                className="h-11 px-4 rounded-xl border border-stone-200 dark:border-[#2B3238] text-sm font-semibold text-stone-700 dark:text-[#F5F7F5] hover:bg-stone-50 dark:hover:bg-[#252A2E] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={16} strokeWidth={2.5} /> Reopen
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowSaleModal(true)}
                  className="h-11 px-4 rounded-xl border border-stone-200 dark:border-[#2B3238] text-sm font-semibold text-stone-700 dark:text-[#F5F7F5] hover:bg-stone-50 dark:hover:bg-[#252A2E] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShoppingCart size={16} strokeWidth={2.5} /> Record sale
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(true)}
                  className="h-11 px-4 rounded-xl bg-[#DFFF83] hover:bg-[#C5E95A] text-sm font-semibold text-[#17191A] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Flag size={16} strokeWidth={2.5} /> Complete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDownload}
              aria-label={report.title}
              title={report.title}
              className="w-11 h-11 rounded-xl border border-stone-200 dark:border-[#2B3238] text-stone-600 dark:text-[#94A3B8] hover:bg-stone-50 dark:hover:bg-[#252A2E] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Download size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              aria-label={`Delete ${batch.name}`}
              title={`Delete ${batch.name}`}
              className="w-11 h-11 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Trash2 size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* The three things to check first */}
      {closed ? (
        <div className="grid grid-cols-3 gap-3">
          <TopTile label="Birds placed" value={Number(batch.birdCount || 0).toLocaleString()} />
          <TopTile label="Birds sold" value={batch.birdsSold != null ? Number(batch.birdsSold).toLocaleString() : '-'} />
          <TopTile label="Days" value={activeDays == null ? '-' : activeDays} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TopTile
              label="Birds alive"
              value={currentBirds.toLocaleString()}
              note={deathsThisWeek ? `${deathsThisWeek} died this week` : 'No deaths this week'}
              tone={deathsThisWeek ? 'warn' : 'plain'}
            />
            <TopTile
              label="Today"
              value={loggedToday ? 'Recorded' : 'Not recorded yet'}
              note={loggedToday ? 'Something is logged for today' : 'Tap to log today'}
              tone={loggedToday ? 'good' : 'warn'}
              onClick={loggedToday ? undefined : () => setLogModal('today')}
            />
            <TopTile
              label="Next vaccine"
              value={nextVaccine ? nextVaccine.vaccineName : 'None planned'}
              note={nextVaccine ? nextWhen : 'Schedule one to get a reminder'}
              tone={nextOverdue ? 'bad' : 'plain'}
              action={nextVaccine ? { label: 'Mark as given', onClick: () => recordScheduled(nextVaccine) } : { label: 'Schedule', onClick: () => openVaccination({ mode: 'schedule' }) }}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button
              type="button"
              onClick={() => setLogModal('today')}
              className="h-14 rounded-2xl bg-[#DFFF83] hover:bg-[#C5E95A] active:bg-[#B3D944] text-[#17191A] text-base font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <ClipboardList size={20} /> Log today
            </button>
            <button
              type="button"
              onClick={() => setLogModal('more')}
              className="h-14 px-5 rounded-2xl border border-stone-300 dark:border-[#2B3238] bg-white dark:bg-[#1E2124] text-stone-800 dark:text-[#F5F7F5] text-base font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer hover:bg-stone-50 dark:hover:bg-[#252A2E]"
            >
              <MoreHorizontal size={20} /> More
            </button>
          </div>
        </>
      )}

      {/* The one trend that matters for this bird type */}
      <div className={card}>
        <h2 className={h2}>{productionTitle}</h2>
        {loading ? (
          <div className="mt-4 h-40 rounded-lg bg-stone-100 dark:bg-[#252A2E] animate-pulse" />
        ) : production.empty ? (
          <p className="mt-3 text-base text-stone-500 dark:text-[#94A3B8]">{production.empty}</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <div className="text-sm text-stone-500 dark:text-[#94A3B8]">{production.title} · {production.caption}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold font-heading text-stone-950 dark:text-[#F5F7F5] tabular-nums leading-none">{production.value}</span>
                  <span className="text-base text-stone-500 dark:text-[#94A3B8]">{production.suffix}</span>
                </div>
              </div>
              {production.change && (
                <span className={`inline-flex items-center gap-1 text-sm ${production.change.up ? 'text-[#4D6600] dark:text-[#DFFF83]' : 'text-rose-600 dark:text-rose-400'}`}>
                  {production.change.up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {production.change.text}
                </span>
              )}
            </div>
            {production.extras?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-500 dark:text-[#94A3B8]">
                {production.extras.map((x) => (
                  <span key={x.label}>
                    {x.label}: <strong className="font-semibold text-stone-900 dark:text-[#F5F7F5]">{x.value}</strong>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4">
              {production.points ? (
                <LineChart points={production.points} formatTick={production.formatTick} />
              ) : (
                <p className="text-base text-stone-500 dark:text-[#94A3B8]">{production.thin}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-stone-100 dark:bg-[#17191A]" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-11 rounded-xl text-sm sm:text-base font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#2B3238] text-stone-950 dark:text-[#F5F7F5] shadow-xs'
                : 'text-stone-500 dark:text-[#94A3B8] hover:text-stone-900 dark:hover:text-[#F5F7F5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (
        <div className={card}>
          <h2 className={`${h2} mb-2`}>Records</h2>
          {dailyLogs.length === 0 ? (
            <EmptyState icon={Activity} title="Nothing recorded for this batch yet." description="Use “Log today” to start." />
          ) : (
            dailyLogs.map((item, index) => (
              <LogRow key={index} icon={item.icon} pending={item.pending} primary={item.kind} secondary={item.detail} value={formatDate(item.date)} />
            ))
          )}
        </div>
      )}

      {activeTab === 'health' && (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className={h2}>Vaccines due</h2>
              <button type="button" onClick={() => openVaccination({ mode: 'schedule' })} className={linkButton}>
                <Plus size={16} strokeWidth={2.5} /> Schedule
              </button>
            </div>
            {dueVaccines.length === 0 ? (
              <EmptyState icon={VaccineIcon} title="No vaccinations due." description="Schedule the next one so you get a reminder." />
            ) : (
              dueVaccines.map((item) => {
                const overdue = item.status === 'missed' || item.dueDate < todayIso;
                return (
                  <div key={item.scheduleId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 border-b border-stone-100 dark:border-[#2B3238] last:border-0">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-stone-900 dark:text-[#F5F7F5] break-words">
                        {item.vaccineName}{item.doseNumber ? ` · ${item.doseNumber}` : ''}
                      </div>
                      <div className={`text-sm ${overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-stone-500 dark:text-[#94A3B8]'}`}>
                        {overdue ? 'Overdue since ' : 'Due '}{formatDate(item.dueDate)}
                        {ROUTES[item.route] && <span className="text-stone-500 dark:text-[#94A3B8] font-normal"> · {ROUTES[item.route].label}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => recordScheduled(item)}
                      className="h-11 px-4 rounded-xl text-sm font-semibold border border-[#D2EC7A] dark:border-[#B7DA3E]/40 text-[#4D6600] dark:text-[#DFFF83] hover:bg-[#F7FFE0] dark:hover:bg-[#252A2E] transition-colors cursor-pointer shrink-0"
                    >
                      Mark as given
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className={card}>
            <h2 className={`${h2} mb-4`}>Health calendar</h2>
            <CalendarPicker
              variant="full"
              value={calendarDate}
              onChange={setCalendarDate}
              events={healthEvents}
              onEventClick={(e) => {
                if (e.kind === 'vaccine' && e.status !== 'done' && e.source?.scheduleId) recordScheduled(e.source);
              }}
            />
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className={h2}>Vaccines given</h2>
              <button type="button" onClick={() => openVaccination({ mode: 'record' })} className={linkButton}>
                <Plus size={16} strokeWidth={2.5} /> Record
              </button>
            </div>
            {vaccinationHistory.length === 0 ? (
              <EmptyState icon={VaccineIcon} title="No vaccinations recorded for this batch yet." />
            ) : (
              vaccinationHistory.map((v) => (
                <LogRow
                  key={v.key}
                  icon={VaccineIcon}
                  pending={v.pending}
                  primary={`${v.vaccineName}${v.doseNumber ? ` · ${v.doseNumber}` : ''}`}
                  secondary={[ROUTES[v.route]?.label, v.birds ? `${Number(v.birds).toLocaleString()} birds` : null, v.administeredBy ? `by ${v.administeredBy}` : null].filter(Boolean).join(' · ') || 'Given'}
                  value={formatDate(v.date)}
                />
              ))
            )}
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className={h2}>Vitamins &amp; dewormers</h2>
              <button type="button" onClick={() => setLogModal('multivitamin')} className={linkButton}>
                <Plus size={16} strokeWidth={2.5} /> Record
              </button>
            </div>
            {multivitaminLogs.length === 0 ? (
              <EmptyState icon={PillIcon} title="None recorded for this batch yet." description="Record a dewormer to get told when eggs and meat are safe to sell again." />
            ) : (
              multivitaminLogs.map((item) => (
                <LogRow
                  key={item.id}
                  icon={PillIcon}
                  primary={`${item.product}${findSupplementType(item.type) ? ` · ${findSupplementType(item.type).label}` : ''}`}
                  secondary={[describeDose(item), item.reason, item.withdrawalDays ? `don't sell eggs or meat for ${item.withdrawalDays} days after` : null].filter(Boolean).join(' · ')}
                  value={formatDate(item.date)}
                />
              ))
            )}
          </div>

          <SickBayTab batch={batch} birdsAlive={currentBirds} readOnly={closed} onMortalityLogged={refreshMortality} openSignal={sickBaySignal} />
        </>
      )}

      {activeTab === 'feed' && (
        <div className={card}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className={h2}>Feed</h2>
            {!closed && (
              <button type="button" onClick={() => setLogModal('feed')} className={linkButton}>
                <Plus size={16} strokeWidth={2.5} /> Log feed
              </button>
            )}
          </div>
          {feedLogs.length === 0 ? (
            <EmptyState icon={FeedIcon} title="No feed recorded for this batch yet." />
          ) : (
            feedLogs.map((entry, index) => (
              <LogRow
                key={entry.entryId || index}
                icon={FeedIcon}
                pending={entry.pending}
                primary={[entry.feedType || 'Feed', entry.brand].filter(Boolean).join(' · ')}
                secondary={formatDate(entry.date)}
                value={formatBags(feedBags(entry))}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className={card}>
          <h2 className={`${h2} mb-2`}>Summary</h2>
          <StatRow label="Birds placed" value={Number(batch.birdCount || 0).toLocaleString()} />
          <StatRow label="Birds alive" value={currentBirds.toLocaleString()} />
          <StatRow label="Deaths" value={`${totalMortality.toLocaleString()}${lossPercent == null ? '' : ` (${lossPercent}%)`}`} />
          {Number(batch.birdsSoldToDate) > 0 && <StatRow label="Birds sold" value={Number(batch.birdsSoldToDate).toLocaleString()} />}
          <StatRow label="Days" value={activeDays == null ? '-' : activeDays} />
          {isLayer && (
            <>
              <StatRow label="Eggs collected" value={totalEggs ? `${totalEggs.toLocaleString()} (${formatCrates(totalEggs)})` : '-'} />
              <StatRow label="Eggs per day" value={avgEggsPerDay == null ? '-' : avgEggsPerDay.toLocaleString()} />
              <StatRow label="Best day" value={peakEggDay == null ? '-' : `${peakEggDay.toLocaleString()} eggs`} />
            </>
          )}
          {!isLayer && (
            <>
              <StatRow label="Latest average weight" value={latestWeight ? formatKg(latestWeight.averageWeightKg) : '-'} note={latestWeight ? `Weighed ${formatDate(latestWeight.date)}` : 'Log a weigh-in from More'} />
              <StatRow label="Weight gained per bird" value={weightGain == null ? '-' : formatChange(weightGain)} note={weightGain == null ? 'Needs 2 weigh-ins' : `Since ${formatDate(firstWeight.date)}`} />
            </>
          )}
          <StatRow label="Feed per kg of growth" value={fcrValue} note={fcrNote} />
          <StatRow label="Feed used" value={totalFeedBags > 0 ? formatBags(totalFeedBags) : '-'} note={totalFeedCost > 0 ? `₦${totalFeedCost.toLocaleString()}` : null} />
          <StatRow label="Vaccinations given" value={doneVaccinations} />
        </div>
      )}

      {/* Pop-ups */}
      <LogTodayModal
        open={logModal === 'today'}
        onClose={() => setLogModal(null)}
        batch={batch}
        onSaved={(resources) => resources.forEach(refetch)}
      />

      <Sheet open={logModal === 'more'} onClose={() => setLogModal(null)} icon={MoreHorizontal} title="More" subtitle={batch.name}>
        <div className="grid grid-cols-1 gap-2">
          {moreActions.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setLogModal(null);
                onClick();
              }}
              className="h-14 px-4 rounded-2xl border border-stone-200 dark:border-[#2B3238] hover:bg-stone-50 dark:hover:bg-[#1E2124] flex items-center gap-3 text-base font-semibold text-stone-900 dark:text-[#F5F7F5] transition-colors cursor-pointer"
            >
              <Icon size={20} /> {label}
            </button>
          ))}
        </div>
      </Sheet>

      <FeedUsageModal
        isOpen={logModal === 'feed'}
        onClose={() => setLogModal(null)}
        onSaved={(entry) => setFeedLogs((prev) => [entry, ...prev])}
        defaultBatchId={batchId}
        onAddStock={() => setLogModal('feedStock')}
      />
      <FeedPurchaseModal isOpen={logModal === 'feedStock'} onClose={() => setLogModal('feed')} />

      <Sheet
        open={logModal === 'weight'}
        onClose={() => setLogModal(null)}
        icon={WeightIcon}
        title="Log bird weight"
        subtitle="Weigh a few birds and enter the average."
        footer={
          <button type="submit" form="weight-form" disabled={savingLog} className={PRIMARY_BUTTON}>
            {savingLog ? <><Spinner size={16} /> Saving…</> : 'Save weight'}
          </button>
        }
      >
        <form id="weight-form" onSubmit={handleLogWeight} className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="weight-date">Date</label>
            <input id="weight-date" type="date" max={todayIso} value={logDate} onChange={(e) => setLogDate(e.target.value)} className={FIELD} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="weight-kg">Average weight (kg)</label>
              <input id="weight-kg" type="number" step="0.01" min="0" inputMode="decimal" placeholder="e.g. 1.8" value={avgWeightKg} onChange={(e) => setAvgWeightKg(e.target.value)} className={FIELD} required />
            </div>
            <div>
              <label className={LABEL} htmlFor="weight-n">Birds weighed</label>
              <input id="weight-n" type="number" min="1" inputMode="numeric" placeholder="e.g. 10" value={weightSampleSize} onChange={(e) => setWeightSampleSize(e.target.value)} className={FIELD} />
            </div>
          </div>
        </form>
      </Sheet>

      <VaccinationModal
        isOpen={logModal === 'vaccine'}
        onClose={() => setLogModal(null)}
        onSaved={handleVaccinationSaved}
        defaultBatchId={batchId}
        events={healthEvents}
        prefill={vacPrefill}
      />

      <SupplementModal
        isOpen={logModal === 'multivitamin'}
        onClose={() => setLogModal(null)}
        onSaved={setAllSupplements}
        defaultBatchId={batchId}
        events={healthEvents}
      />

      <SaleModal open={showSaleModal} onClose={() => setShowSaleModal(false)} defaultBatchId={batchId} />

      <CompleteBatchModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        batch={batch}
        purpose={purpose}
        birdsAlive={currentBirds}
        otherCosts={costs.feed + costs.vaccines + costs.supplements}
        onConfirm={handleCompleteBatch}
      />

      <DeleteBatchModal
        open={showDeleteModal}
        batch={batch}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteBatch}
      />
    </div>
  );
}

export default BatchDetailPage;
