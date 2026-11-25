import { useEffect, useState } from 'react';
import { Check, Flag } from 'lucide-react';
import { Sheet, FIELD, LABEL, PRIMARY_BUTTON } from './Sheet';
import { NairaInput } from './NairaInput';
import { Spinner } from './Spinner';
import { birdTypeLabel } from '../../lib/batch';

const naira = (n) => `${n < 0 ? '−' : ''}₦${Math.round(Math.abs(n)).toLocaleString()}`;

/**
 * Mark a batch as completed (closed). Records what the farmer sold, since
 * sales are what meat-bird performance is judged on, and fills in the bird
 * cost if it wasn't given at creation. The batch then moves to History.
 *
 * Props:
 *  open, onClose, batch, purpose ('eggs'|'meat'|'dual'|'other'),
 *  birdsAlive, otherCosts (feed + vaccines + vitamins, ₦),
 *  onConfirm(updates) — async; receives the PATCH body.
 */
export function CompleteBatchModal({ open, onClose, batch, purpose, birdsAlive, otherCosts = 0, onConfirm }) {
  const [birdsSold, setBirdsSold] = useState('');
  const [revenue, setRevenue] = useState('');
  const [birdCost, setBirdCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBirdsSold(String(birdsAlive || 0));
    setRevenue('');
    setBirdCost('');
    setNotes('');
    setSaving(false);
    setError('');
  }, [open, birdsAlive]);

  if (!open || !batch) return null;

  const eggsOnly = purpose === 'eggs';
  const hasBirdCost = Number(batch.purchaseCostNaira) > 0;
  const sold = Number(birdsSold) || 0;
  const sales = Number(revenue) || 0;
  const birdsCostNum = hasBirdCost ? Number(batch.purchaseCostNaira) : Number(birdCost) || 0;
  const profit = sales - birdsCostNum - otherCosts;
  const tooMany = sold > birdsAlive;

  const handleConfirm = async () => {
    if (tooMany) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        status: 'closed',
        birdsSold: sold,
        ...(sales > 0 ? { salesRevenueNaira: sales } : {}),
        ...(!hasBirdCost && Number(birdCost) > 0 ? { purchaseCostNaira: Number(birdCost) } : {}),
        ...(notes.trim() ? { completionNotes: notes.trim() } : {}),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not complete the batch');
      setSaving(false);
    }
  };

  const muted = 'text-stone-500 dark:text-[#94A3B8]';
  const strong = 'text-stone-900 dark:text-[#F5F7F5]';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={Flag}
      title={`Complete ${batch.name}`}
      subtitle={`${birdTypeLabel(batch.type)} · ${birdsAlive.toLocaleString()} birds alive`}
      footer={
        <button type="button" onClick={handleConfirm} disabled={saving || tooMany} className={PRIMARY_BUTTON}>
          {saving ? <Spinner /> : <Check size={18} />} {saving ? 'Completing…' : 'Complete Batch'}
        </button>
      }
    >
      <p className="text-base">
        Completing closes the batch and moves it to History. All its records stay there to view.
        {!eggsOnly && " Record what you sold so the batch's profit can be worked out."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>{eggsOnly ? 'Old layers sold' : 'Birds sold'}</label>
          <input type="number" min="0" max={birdsAlive} inputMode="numeric" value={birdsSold} onChange={(e) => setBirdsSold(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Total sales{eggsOnly && <span className={`font-normal ${muted}`}> (optional)</span>}</label>
          <NairaInput value={revenue} onChange={setRevenue} placeholder="₦0" />
        </div>
      </div>
      {tooMany && <p className="text-sm text-rose-600 dark:text-rose-400 -mt-2">Only {birdsAlive.toLocaleString()} birds are alive in this batch.</p>}
      {sold > 0 && sales > 0 && <p className={`text-sm -mt-2 ${muted}`}>About {naira(sales / sold)} per bird.</p>}

      {!hasBirdCost && (
        <div>
          <label className={LABEL}>What the birds cost to buy <span className={`font-normal ${muted}`}>(optional)</span></label>
          <NairaInput value={birdCost} onChange={setBirdCost} placeholder="For the whole batch" />
          <p className={`text-sm mt-1 ${muted}`}>Not recorded when the batch was created. Without it, profit leaves out the cost of the birds.</p>
        </div>
      )}

      <div>
        <label className={LABEL}>Notes <span className={`font-normal ${muted}`}>(optional)</span></label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${FIELD} h-auto py-3 resize-none`} placeholder="e.g. Sold to Mile 12 market" />
      </div>

      {sales > 0 && (
        <div className="rounded-2xl border border-stone-200 dark:border-[#2B3238] bg-stone-50 dark:bg-[#1E2124] p-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span className={muted}>Sales</span><span className={`font-semibold ${strong}`}>{naira(sales)}</span></div>
          <div className="flex justify-between"><span className={muted}>Birds</span><span className={strong}>{birdsCostNum ? `−${naira(birdsCostNum)}` : 'not recorded'}</span></div>
          <div className="flex justify-between"><span className={muted}>Feed, vaccines and vitamins</span><span className={strong}>−{naira(otherCosts)}</span></div>
          <div className="flex justify-between pt-1.5 border-t border-stone-200 dark:border-[#2B3238]">
            <span className={`font-semibold ${strong}`}>{profit >= 0 ? 'Profit' : 'Loss'}</span>
            <span className={`font-bold ${profit >= 0 ? 'text-[#4D6600] dark:text-[#DFFF83]' : 'text-rose-600 dark:text-rose-400'}`}>{naira(profit)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </Sheet>
  );
}

export default CompleteBatchModal;
