import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList } from 'lucide-react';
import { Sheet, FIELD, LABEL, PRIMARY_BUTTON } from './Sheet';
import { NairaInput } from './NairaInput';
import { Spinner } from './Spinner';
import { useToast } from './Toast';
import { EggIcon } from './EggIcon';
import { BirdIcon } from './BirdIcon';
import { FeedIcon } from './FeedIcon';
import { createLog } from '../../api/logs';
import { QUEUED_SAVE_MESSAGE } from '../../lib/offlineQueue';
import { useFeedStock } from '../../lib/useFeedStock';
import { FEED_BAG_KG, formatBags, laysEggs } from '../../lib/batch';
import { toIso } from '../../lib/supplements';

const OTHER_FEED = '__other';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-stone-200 dark:border-[#2B3238] p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold text-stone-950 dark:text-[#F5F7F5]">
        <Icon size={18} /> {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Today's records for one batch on one screen: eggs (laying birds), deaths
 * and feed. Anything left blank is skipped. Each part saves as its own log
 * entry, so offline saves queue exactly like the single forms did.
 *
 * Props: open, onClose, batch, onSaved(resources saved, e.g. ['eggs', 'feed'])
 */
export function LogTodayModal({ open, onClose, batch, onSaved }) {
  const toast = useToast();
  const isLayer = laysEggs(batch?.type);
  const { stock } = useFeedStock({ enabled: open });
  const lines = useMemo(() => [...stock.lines].sort((a, b) => (b.left > 0) - (a.left > 0)), [stock.lines]);

  const [date, setDate] = useState('');
  const [crates, setCrates] = useState('');
  const [singles, setSingles] = useState('');
  const [deaths, setDeaths] = useState('');
  const [cause, setCause] = useState('');
  const [lineKey, setLineKey] = useState('');
  const [bags, setBags] = useState('');
  const [otherType, setOtherType] = useState('');
  const [otherCost, setOtherCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(toIso(new Date()));
    setCrates('');
    setSingles('');
    setDeaths('');
    setCause('');
    setLineKey('');
    setBags('');
    setOtherType('');
    setOtherCost('');
    setSaving(false);
  }, [open]);

  // Feed in store first; no store at all means "other feed".
  useEffect(() => {
    if (!open || lineKey) return;
    const pick = lines.find((l) => l.left > 0);
    if (pick) setLineKey(pick.key);
  }, [open, lines, lineKey]);

  if (!open || !batch) return null;

  const other = lineKey === OTHER_FEED || lines.length === 0;
  const line = other ? null : lines.find((l) => l.key === lineKey);
  const bagCount = Number(bags) || 0;
  const feedType = other ? otherType.trim() : line?.feedType;
  const eggsGiven = (Number(crates) || 0) > 0 || (Number(singles) || 0) > 0;
  const deathsGiven = (Number(deaths) || 0) > 0;
  const feedGiven = bagCount > 0 && Boolean(feedType);
  const canSave = date && (eggsGiven || deathsGiven || feedGiven) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const jobs = [];
    if (eggsGiven) jobs.push(['eggs', { date, crates: Number(crates) || 0, looseEggs: Number(singles) || 0 }]);
    if (deathsGiven) jobs.push(['mortality', { date, count: Number(deaths), ...(cause.trim() ? { note: cause.trim() } : {}) }]);
    if (feedGiven) {
      const bagSizeKg = line?.bagSizeKg || FEED_BAG_KG;
      const cost = other ? Number(otherCost) || 0 : line?.avgPrice ? bagCount * line.avgPrice : 0;
      jobs.push(['feed', {
        date,
        feedType,
        ...(line?.brand ? { brand: line.brand } : {}),
        bags: bagCount,
        bagSizeKg,
        amountKg: bagCount * bagSizeKg,
        costNaira: Math.round(cost),
      }]);
    }

    const saved = [];
    let queued = false;
    try {
      for (const [resource, payload] of jobs) {
        const result = await createLog(batch.batchId, resource, payload);
        if (result?.queued) queued = true;
        saved.push(resource);
      }
      toast(queued ? QUEUED_SAVE_MESSAGE : "Today's records saved", 'success');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      // Some parts may have saved already; say which, and keep the form open.
      if (saved.length) onSaved?.(saved);
      toast(`${saved.length ? `Saved ${saved.join(' and ')}, but ` : ''}${err.message || 'could not save'}`, 'error');
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={ClipboardList}
      title="Log today"
      subtitle={`${batch.name} · leave blank what didn't happen`}
      footer={
        <button type="button" onClick={handleSave} disabled={!canSave} className={PRIMARY_BUTTON}>
          {saving ? <Spinner size={18} /> : <Check size={18} />}
          <span>{saving ? 'Saving…' : 'Save'}</span>
        </button>
      }
    >
      <div>
        <label className={LABEL} htmlFor="today-date">Date</label>
        <input id="today-date" type="date" max={toIso(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
      </div>

      {isLayer && (
        <Section icon={EggIcon} title="Eggs collected">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="today-crates">Crates (30 each)</label>
              <input id="today-crates" type="number" min="0" inputMode="numeric" value={crates} onChange={(e) => setCrates(e.target.value)} className={FIELD} placeholder="0" />
            </div>
            <div>
              <label className={LABEL} htmlFor="today-singles">Singles</label>
              <input id="today-singles" type="number" min="0" inputMode="numeric" value={singles} onChange={(e) => setSingles(e.target.value)} className={FIELD} placeholder="0" />
            </div>
          </div>
        </Section>
      )}

      <Section icon={BirdIcon} title="Birds that died">
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <div>
            <label className={LABEL} htmlFor="today-deaths">How many</label>
            <input id="today-deaths" type="number" min="0" inputMode="numeric" value={deaths} onChange={(e) => setDeaths(e.target.value)} className={FIELD} placeholder="0" />
          </div>
          <div>
            <label className={LABEL} htmlFor="today-cause">Cause <span className="font-normal text-stone-500">(if known)</span></label>
            <input id="today-cause" type="text" value={cause} onChange={(e) => setCause(e.target.value)} className={FIELD} placeholder="e.g. heat" />
          </div>
        </div>
      </Section>

      <Section icon={FeedIcon} title="Feed given">
        {lines.length > 0 && (
          <div>
            <label className={LABEL} htmlFor="today-feed">Which feed</label>
            <select id="today-feed" value={lineKey} onChange={(e) => setLineKey(e.target.value)} className={`${FIELD} cursor-pointer`}>
              {lines.map((l) => (
                <option key={l.key} value={l.key}>{l.label} ({formatBags(Math.max(l.left, 0))} left)</option>
              ))}
              <option value={OTHER_FEED}>Feed not in your store</option>
            </select>
          </div>
        )}
        {other && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="today-feed-type">Feed name</label>
              <input id="today-feed-type" type="text" value={otherType} onChange={(e) => setOtherType(e.target.value)} className={FIELD} placeholder="e.g. Layer mash" />
            </div>
            <div>
              <label className={LABEL} htmlFor="today-feed-cost">Cost</label>
              <NairaInput id="today-feed-cost" value={otherCost} onChange={setOtherCost} placeholder="₦0" />
            </div>
          </div>
        )}
        <div>
          <label className={LABEL} htmlFor="today-bags">Bags used</label>
          <input id="today-bags" type="number" min="0" step="0.5" inputMode="decimal" value={bags} onChange={(e) => setBags(e.target.value)} className={FIELD} placeholder="e.g. 2" />
        </div>
        {line && bagCount > Math.max(line.left, 0) && (
          <p className="text-sm text-amber-700 dark:text-amber-400">More than the {formatBags(Math.max(line.left, 0))} in your store. Record the feed you bought in Store.</p>
        )}
      </Section>
    </Sheet>
  );
}
