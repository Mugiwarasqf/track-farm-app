import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * The app's one pop-up: a bottom sheet on phones, a centred card on wider
 * screens. Header, scrolling body, optional fixed footer. Escape and the
 * backdrop close it.
 *
 * Props: open, onClose, title, subtitle, icon (component), footer, children
 */
export function Sheet({ open, onClose, title, subtitle, icon: Icon, footer, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="relative bg-white dark:bg-[#17191A] w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl z-10 animate-fade-in flex flex-col max-h-[92vh] border border-stone-200/50 dark:border-[#2B3238]"
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-stone-100 dark:border-[#2B3238] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-11 h-11 rounded-xl bg-[#F7FFE0] dark:bg-[#DFFF83]/10 text-[#4D6600] dark:text-[#DFFF83] flex items-center justify-center shrink-0">
                <Icon size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-stone-950 dark:text-[#F5F7F5] font-heading truncate">{title}</h2>
              {subtitle && <p className="text-sm text-stone-500 dark:text-[#94A3B8] truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 dark:text-[#94A3B8] hover:text-stone-900 dark:hover:text-[#F5F7F5] hover:bg-stone-100 dark:hover:bg-[#1E2124] transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5 text-sm text-stone-700 dark:text-[#94A3B8]">{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-stone-100 dark:border-[#2B3238] shrink-0 space-y-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Shared form styles, so every sheet's fields look the same in both themes. */
export const FIELD =
  'w-full h-12 px-3.5 bg-white dark:bg-[#1E2124] border border-stone-300 dark:border-[#2B3238] rounded-xl text-base text-stone-900 dark:text-[#F5F7F5] focus:outline-hidden focus:ring-2 focus:ring-[#DFFF83]/70 focus:border-[#B7DA3E] transition-all placeholder:text-stone-400 dark:placeholder:text-[#64748B]';
export const LABEL = 'text-sm font-bold text-stone-800 dark:text-[#F5F7F5] block mb-1.5';
export const PRIMARY_BUTTON =
  'w-full h-12 rounded-2xl font-bold text-base transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[#DFFF83] hover:bg-[#C5E95A] active:bg-[#B3D944] text-[#17191A] shadow-xs';
export const DANGER_BUTTON =
  'w-full h-12 rounded-2xl font-bold text-base transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 bg-rose-600 hover:bg-rose-700 text-white';
export const SECONDARY_BUTTON =
  'w-full h-12 rounded-2xl font-bold text-base transition-colors inline-flex items-center justify-center gap-2 cursor-pointer border border-stone-300 dark:border-[#2B3238] text-stone-700 dark:text-[#F5F7F5] hover:bg-stone-50 dark:hover:bg-[#1E2124]';

/** Yes/no question in the same sheet, instead of the browser's grey confirm box. */
export function ConfirmSheet({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={danger ? DANGER_BUTTON : PRIMARY_BUTTON}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-base">{message}</p>
    </Sheet>
  );
}
