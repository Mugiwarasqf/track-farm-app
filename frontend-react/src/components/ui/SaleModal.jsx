import { useEffect, useMemo, useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { Sheet, FIELD, LABEL, PRIMARY_BUTTON } from './Sheet';
import { NairaInput } from './NairaInput';
import { useBatches } from '../../context/BatchContext';
import { useToast } from './Toast';
import { Spinner } from './Spinner';
import { createSale, getEggStock } from '../../api/sales';
import { isNetworkError } from '../../api/client';
import { allBirdTypes, birdTypeLabel, laysEggs, EGGS_PER_CRATE } from '../../lib/batch';
import { toIso } from '../../lib/supplements';
import { formatNaira } from '../../lib/feeds';


export const EGG_SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
  { id: 'jumbo', label: 'Jumbo' },
];

const isActive = (b) => (b.status || 'active') !== 'closed';

/** 365 → "12 crates + 5 singles" */
function cratesAndSingles(eggs) {
  const crates = Math.floor(eggs / EGGS_PER_CRATE);
  const singles = eggs % EGGS_PER_CRATE;
  const parts = [];
  if (crates) parts.push(`${crates.toLocaleString()} crate${crates === 1 ? '' : 's'}`);
  if (singles || !crates) parts.push(`${singles} single${singles === 1 ? '' : 's'}`);
  return parts.join(' + ');
}
const alive = (b) => Number(b.currentBirds ?? b.birdCount) || 0;

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
            value === o.id
              ? 'bg-[#DFFF83] border-[#B7DA3E] text-[#17191A]'
              : 'bg-white dark:bg-[#1E2124] border-stone-300 dark:border-[#2B3238] text-stone-700 dark:text-[#94A3B8] hover:border-stone-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Record a sale of birds or eggs. Birds: pick the bird type, then the batch
 * they came from (lowers its birds alive; a type with no batch just records
 * the sale). Eggs: pick the size and whether
 * it's crates or pieces; the batch is optional.
 *
 * Props: open, onClose, onSaved(sale), defaultBatchId
 */
export function SaleModal({ open, onClose, onSaved, defaultBatchId = '' }) {
  const { batches, loadBatches } = useBatches();
  const toast = useToast();
  const active = useMemo(() => batches.filter(isActive), [batches]);

  const [product, setProduct] = useState('birds');
  const [date, setDate] = useState('');
  const [birdType, setBirdType] = useState('');
  const [batchId, setBatchId] = useState('');
  const [eggSize, setEggSize] = useState('large');
  const [unit, setUnit] = useState('crates');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [eggStock, setEggStock] = useState(null);

  // Every bird type (built-in and the farm's own), plus any older type a
  // batch still uses. Types with birds on the farm come first.
  const birdTypes = useMemo(() => {
    const stocked = new Set(active.filter((b) => alive(b) > 0).map((b) => (b.type || 'other').toLowerCase()));
    const ids = [...new Set([...allBirdTypes().map((t) => t.value), ...stocked])];
    return ids
      .map((id) => ({ id, label: birdTypeLabel(id), stocked: stocked.has(id) }))
      .sort((a, b) => b.stocked - a.stocked);
  }, [active]);

  const birdBatches = active.filter((b) => (b.type || 'other').toLowerCase() === birdType && alive(b) > 0);
  const eggBatches = active.filter((b) => laysEggs(b.type));

  useEffect(() => {
    if (!open) return;
    const preset = active.find((b) => b.batchId === defaultBatchId);
    const presetIsLayer = preset && laysEggs(preset.type);
    setProduct(presetIsLayer ? 'eggs' : 'birds');
    setDate(toIso(new Date()));
    setBirdType(preset ? (preset.type || 'other').toLowerCase() : birdTypes[0]?.id || '');
    setBatchId(preset?.batchId || '');
    setEggSize('large');
    setUnit('crates');
    setQuantity('');
    setPrice('');
    setBuyer('');
    setSaving(false);
    setError('');
    setEggStock(null);
    getEggStock().then(setEggStock).catch(() => {});
  }, [open]);

  // One batch of the chosen type: pick it for the farmer.
  useEffect(() => {
    if (product !== 'birds') return;
    if (!birdBatches.some((b) => b.batchId === batchId)) setBatchId(birdBatches.length === 1 ? birdBatches[0].batchId : '');
  }, [product, birdType]);

  if (!open) return null;

  const changeProduct = (next) => {
    setProduct(next);
    setBatchId('');
  };

  const qty = Number(quantity) || 0;
  const unitPrice = Number(price) || 0;
  const total = Math.round(qty * unitPrice);
  const batch = active.find((b) => b.batchId === batchId);
  const maxBirds = product === 'birds' && batch ? alive(batch) : null;
  const tooMany = maxBirds != null && qty > maxBirds;
  const unitWord = product === 'birds' ? 'bird' : unit === 'crates' ? 'crate' : 'egg';
  // Eggs left where this sale comes from: the batch if one is picked, else the farm.
  const eggsLeft = eggStock ? (batchId ? eggStock.byBatch[batchId] ?? 0 : eggStock.eggsLeft) : null;
  const eggsWanted = unit === 'crates' ? qty * EGGS_PER_CRATE : qty;
  const overStock = product === 'eggs' && eggsLeft != null && eggsWanted > eggsLeft;

  const canSave =
    date && qty > 0 && unitPrice >= 0 && price !== '' && !tooMany &&
    (product === 'birds' ? Boolean(birdType) && (Boolean(batchId) || birdBatches.length === 0) && Number.isInteger(qty) : Boolean(eggSize));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    try {
      const sale = await createSale({
        date,
        product,
        quantity: qty,
        pricePerUnitNaira: unitPrice,
        ...(batchId ? { batchId } : {}),
        ...(product === 'eggs' ? { eggSize, unit } : { birdType }),
        ...(buyer.trim() ? { buyer: buyer.trim() } : {}),
      });
      toast(`Sale of ${formatNaira(sale.amountNaira)} recorded`, 'success');
      if (product === 'birds') loadBatches();
      onSaved?.(sale);
      onClose();
    } catch (err) {
      setError(isNetworkError(err) ? 'No network. Connect and save the sale again.' : err.message || 'Could not save the sale');
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={ShoppingCart}
      title="Record a sale"
      subtitle="Money in from birds or eggs you sold."
      footer={
        <>
          {qty > 0 && price !== '' && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 dark:bg-[#1E2124] border border-stone-200 dark:border-[#2B3238] rounded-2xl text-xs">
              <span className="text-stone-600 dark:text-[#94A3B8]">{qty.toLocaleString()} × {formatNaira(unitPrice)}</span>
              <strong className="text-sm text-stone-950 dark:text-[#F5F7F5]">{formatNaira(total)}</strong>
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={PRIMARY_BUTTON}
          >
            {saving ? <Spinner size={16} /> : <Check size={16} />}
            <span>{saving ? 'Saving…' : 'Save Sale'}</span>
          </button>
        </>
      }
    >
          <div>
            <span className={LABEL}>What did you sell?</span>
            <Chips
              options={[{ id: 'birds', label: 'Birds' }, { id: 'eggs', label: 'Eggs' }]}
              value={product}
              onChange={changeProduct}
            />
          </div>

          {product === 'birds' ? (
              <>
                <div>
                  <label className={LABEL} htmlFor="sale-type">Type of bird</label>
                  <select id="sale-type" value={birdType} onChange={(e) => setBirdType(e.target.value)} className={`${FIELD} cursor-pointer`}>
                    {birdTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {birdBatches.length > 1 && (
                  <div>
                    <label className={LABEL} htmlFor="sale-batch">From which batch?</label>
                    <select id="sale-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className={`${FIELD} cursor-pointer`}>
                      <option value="">Choose a batch</option>
                      {birdBatches.map((b) => (
                        <option key={b.batchId} value={b.batchId}>{b.name} ({alive(b).toLocaleString()} alive)</option>
                      ))}
                    </select>
                  </div>
                )}
                {batch && (
                  <p className="text-xs text-stone-500 dark:text-[#94A3B8] -mt-2">
                    {batch.name}: {alive(batch).toLocaleString()} birds alive
                  </p>
                )}
                {birdBatches.length === 0 && (
                  <p className="text-xs text-stone-500 dark:text-[#94A3B8] -mt-2">
                    No active {birdTypeLabel(birdType).toLowerCase()} batch, so this sale won't change any batch's bird count.
                  </p>
                )}
              </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-stone-50 dark:bg-[#1E2124] border border-stone-200 dark:border-[#2B3238] rounded-2xl">
                <span className="text-xs text-stone-600 dark:text-[#94A3B8]">
                  Eggs in store{batch ? ` · ${batch.name}` : ''}
                </span>
                <strong className="text-sm text-stone-950 dark:text-[#F5F7F5] text-right">
                  {eggsLeft == null ? '…' : cratesAndSingles(eggsLeft)}
                </strong>
              </div>
              <div>
                <span className={LABEL}>Egg size</span>
                <Chips options={EGG_SIZES} value={eggSize} onChange={setEggSize} />
              </div>
              <div>
                <span className={LABEL}>Sold by</span>
                <Chips
                  options={[{ id: 'crates', label: `Crates (${EGGS_PER_CRATE})` }, { id: 'pieces', label: 'Pieces' }]}
                  value={unit}
                  onChange={setUnit}
                />
              </div>
              {eggBatches.length > 0 && (
                <div>
                  <label className={LABEL} htmlFor="sale-egg-batch">From which batch? <span className="font-normal text-stone-500">(optional)</span></label>
                  <select id="sale-egg-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className={`${FIELD} cursor-pointer`}>
                    <option value="">Whole farm</option>
                    {eggBatches.map((b) => (
                      <option key={b.batchId} value={b.batchId}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="sale-qty">How many {product === 'birds' ? 'birds' : unit}</label>
              <input id="sale-qty" type="number" min="1" max={maxBirds ?? undefined} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={FIELD} placeholder="e.g. 20" />
            </div>
            <div>
              <label className={LABEL} htmlFor="sale-price">Price per {unitWord}</label>
              <NairaInput id="sale-price" value={price} onChange={setPrice} placeholder={product === 'birds' ? '₦7,500' : '₦4,800'} />
            </div>
          </div>
          {tooMany && <p className="text-xs text-rose-600 dark:text-rose-400 -mt-3">Only {maxBirds.toLocaleString()} birds alive in this batch.</p>}
          {overStock && (
            <p className="text-xs text-amber-700 dark:text-amber-400 -mt-3">
              That's more than the {cratesAndSingles(eggsLeft)} recorded. You can still save, but log your egg collection so this stays right.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="sale-date">Date</label>
              <input id="sale-date" type="date" max={toIso(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sale-buyer">Buyer <span className="font-normal text-stone-500">(optional)</span></label>
              <input id="sale-buyer" type="text" value={buyer} onChange={(e) => setBuyer(e.target.value)} className={FIELD} placeholder="e.g. Mama Tope" />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </Sheet>
  );
}
