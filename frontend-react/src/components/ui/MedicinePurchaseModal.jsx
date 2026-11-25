import { useEffect, useState } from 'react';
import { Check, PackagePlus } from 'lucide-react';
import { Sheet, FIELD, LABEL, PRIMARY_BUTTON } from './Sheet';
import { NairaInput } from './NairaInput';
import { Spinner } from './Spinner';
import { useToast } from './Toast';
import { addMedicinePurchase } from '../../api/medicineStock';
import { isNetworkError } from '../../api/client';
import { VACCINES, DOSES_PER_VIAL } from '../../lib/vaccines';
import { SUPPLEMENT_TYPES, findSupplementType, toIso } from '../../lib/supplements';
import { formatNaira } from '../../lib/feeds';
import { unitWord } from '../../lib/medicineStock';

const OTHER = '__other';
const KNOWN_VACCINES = VACCINES.filter((v) => v.id !== 'other');

/**
 * Add vaccines or vitamins/dewormers bought to the store.
 * Vaccines: name, vials and doses per vial. Vitamins: product, type, packs
 * and pack size. Both: price each, expiry, supplier.
 *
 * Props: open, onClose, kind ('vaccine' | 'supplement'), onSaved(purchase)
 */
export function MedicinePurchaseModal({ open, onClose, kind = 'vaccine', onSaved }) {
  const toast = useToast();
  const isVaccine = kind === 'vaccine';

  const [date, setDate] = useState('');
  const [vaccine, setVaccine] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [supplementType, setSupplementType] = useState('multivitamin');
  const [quantity, setQuantity] = useState('');
  const [dosesPerVial, setDosesPerVial] = useState(1000);
  const [packSize, setPackSize] = useState('');
  const [price, setPrice] = useState('');
  const [expiry, setExpiry] = useState('');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(toIso(new Date()));
    setVaccine(KNOWN_VACCINES[0]?.name || OTHER);
    setName('');
    setBrand('');
    setSupplementType('multivitamin');
    setQuantity('');
    setDosesPerVial(1000);
    setPackSize('');
    setPrice('');
    setExpiry('');
    setSupplier('');
    setSaving(false);
    setError('');
  }, [open]);

  if (!open) return null;

  const finalName = isVaccine && vaccine !== OTHER ? vaccine : name.trim();
  const qty = Number(quantity) || 0;
  const total = qty * (Number(price) || 0);
  const canSave = date && finalName && Number.isInteger(qty) && qty > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const saved = await addMedicinePurchase({
        date,
        kind,
        name: finalName,
        quantity: qty,
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(isVaccine ? { dosesPerVial } : { supplementType, ...(packSize.trim() ? { packSize: packSize.trim() } : {}) }),
        ...(price ? { pricePerUnitNaira: Number(price) } : {}),
        ...(expiry ? { expiry } : {}),
        ...(supplier.trim() ? { supplier: supplier.trim() } : {}),
      });
      toast(`${qty} ${unitWord(kind, qty)} of ${finalName} added to your store`, 'success');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(isNetworkError(err) ? 'No network. Connect and save again.' : err.message || 'Could not save');
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={PackagePlus}
      title={isVaccine ? 'Add vaccines to store' : 'Add vitamins to store'}
      subtitle="What you bought and are keeping for later."
      footer={
        <>
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 dark:bg-[#1E2124] border border-stone-200 dark:border-[#2B3238] rounded-2xl text-sm">
              <span>{qty} × {formatNaira(Number(price))}</span>
              <strong className="text-stone-950 dark:text-[#F5F7F5]">{formatNaira(total)}</strong>
            </div>
          )}
          <button type="button" onClick={handleSave} disabled={!canSave} className={PRIMARY_BUTTON}>
            {saving ? <Spinner size={18} /> : <Check size={18} />}
            <span>{saving ? 'Saving…' : 'Add to store'}</span>
          </button>
        </>
      }
    >
      {isVaccine ? (
        <>
          <div>
            <label className={LABEL} htmlFor="med-vaccine">Vaccine</label>
            <select id="med-vaccine" value={vaccine} onChange={(e) => setVaccine(e.target.value)} className={`${FIELD} cursor-pointer`}>
              {KNOWN_VACCINES.map((v) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
              <option value={OTHER}>Another vaccine</option>
            </select>
          </div>
          {vaccine === OTHER && (
            <div>
              <label className={LABEL} htmlFor="med-name">Vaccine name</label>
              <input id="med-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} placeholder="As on the label" />
            </div>
          )}
          <div>
            <label className={LABEL} htmlFor="med-brand">Brand <span className="font-normal text-stone-500">(optional)</span></label>
            <input id="med-brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={FIELD} placeholder="e.g. Vom, Nobilis, Ceva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="med-qty">Vials bought</label>
              <input id="med-qty" type="number" min="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={FIELD} placeholder="e.g. 5" />
            </div>
            <div>
              <label className={LABEL} htmlFor="med-doses">Doses per vial</label>
              <select id="med-doses" value={dosesPerVial} onChange={(e) => setDosesPerVial(Number(e.target.value))} className={`${FIELD} cursor-pointer`}>
                {DOSES_PER_VIAL.map((n) => (
                  <option key={n} value={n}>{n.toLocaleString()}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className={LABEL} htmlFor="med-type">Type</label>
            <select id="med-type" value={supplementType} onChange={(e) => setSupplementType(e.target.value)} className={`${FIELD} cursor-pointer`}>
              {SUPPLEMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="med-product">Product name</label>
            <input id="med-product" type="text" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} placeholder={findSupplementType(supplementType)?.examples || 'As on the label'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="med-qty">Packs bought</label>
              <input id="med-qty" type="number" min="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={FIELD} placeholder="e.g. 10" />
            </div>
            <div>
              <label className={LABEL} htmlFor="med-size">Pack size</label>
              <input id="med-size" type="text" value={packSize} onChange={(e) => setPackSize(e.target.value)} className={FIELD} placeholder="e.g. 100g sachet" />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="med-price">Price per {unitWord(kind, 1)}</label>
          <NairaInput id="med-price" value={price} onChange={setPrice} placeholder="₦0" />
        </div>
        <div>
          <label className={LABEL} htmlFor="med-expiry">Expiry date <span className="font-normal text-stone-500">(optional)</span></label>
          <input id="med-expiry" type="date" min={date} value={expiry} onChange={(e) => setExpiry(e.target.value)} className={FIELD} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="med-date">Date bought</label>
          <input id="med-date" type="date" max={toIso(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="med-supplier">Bought from <span className="font-normal text-stone-500">(optional)</span></label>
          <input id="med-supplier" type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={FIELD} placeholder="e.g. Agro shop" />
        </div>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </Sheet>
  );
}
