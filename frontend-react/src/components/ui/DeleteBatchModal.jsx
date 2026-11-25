import { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Sheet, FIELD, LABEL, DANGER_BUTTON, SECONDARY_BUTTON } from './Sheet';

/**
 * DeleteBatchModal
 * High-tier enterprise confirmation modal for permanently deleting a poultry batch.
 * Features:
 * - Backdrop blur + escape to close
 * - Clear warning callout showing affected data (birds, feed, vaccines)
 * - Name-matching verification to prevent accidental clicks
 * - Loading spinner & disabled state during execution
 */
export function DeleteBatchModal({ open, batch, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Reset state whenever modal opens or batch changes
  useEffect(() => {
    if (open) {
      setConfirmText('');
      setIsDeleting(false);
      setError(null);
    }
  }, [open, batch]);

  if (!open || !batch) return null;

  const batchName = batch.name || 'Untitled Batch';
  const isNameMatch = confirmText.trim().toLowerCase() === batchName.trim().toLowerCase();
  const birdCount = Number(batch.currentBirds ?? batch.birdCount ?? 0);

  const handleDelete = async () => {
    if (!isNameMatch || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(batch.batchId);
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err?.message || 'Failed to delete batch. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => !isDeleting && onClose()}
      icon={Trash2}
      title="Delete batch"
      subtitle="This can't be undone"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={isDeleting} className={SECONDARY_BUTTON}>Cancel</button>
          <button type="button" onClick={handleDelete} disabled={!isNameMatch || isDeleting} className={DANGER_BUTTON}>
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            <span>{isDeleting ? 'Deleting…' : 'Delete'}</span>
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-2 text-rose-900 dark:text-rose-200">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertTriangle size={18} className="shrink-0" />
          <span>Delete "{batchName}" and everything in it</span>
        </div>
        <ul className="text-sm space-y-1 list-disc list-inside pl-1">
          <li>{birdCount.toLocaleString()} birds' records</li>
          <li>Every egg, feed, death and weight entry</li>
          <li>Vaccinations, vitamins, sick bay cases and sales</li>
        </ul>
      </div>

      <div>
        <label htmlFor="batch-confirm-input" className={LABEL}>
          Type <span className="font-mono select-all px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#2B3238]">{batchName}</span> to confirm
        </label>
        <input
          id="batch-confirm-input"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={isDeleting}
          placeholder={batchName}
          className={FIELD}
          autoComplete="off"
          autoFocus
        />
      </div>

      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </Sheet>
  );
}

export default DeleteBatchModal;
