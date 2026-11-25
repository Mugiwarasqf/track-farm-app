import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Syringe, ClipboardList, X } from 'lucide-react';
import { claimCardSlot, cardDue, recordCardShown } from '../../lib/pwa';
import { enablePush, pushState } from '../../lib/push';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { AppTile, PRIMARY, SECONDARY } from './InstallPrompt';

const CARD_KEY = 'trackfarm_push_card';
/** A little after the install card's delay, so that one goes first when both apply. */
const SHOW_DELAY_MS = 5000;

function Reason({ icon: Icon, children }) {
  return (
    <li className="flex items-center gap-3 text-[13px] text-stone-700 dark:text-[#CBD5E1]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-[#252A2E]">
        <Icon size={16} strokeWidth={2.25} className="text-[#4D6600] dark:text-[#DFFF83]" aria-hidden="true" />
      </span>
      {children}
    </li>
  );
}

/**
 * "Get reminders on your phone" — a bottom sheet on the dashboard, phones only.
 *
 * Only when phone notifications can actually be turned on right now (state
 * 'off': supported, not blocked, and on iPhone already on the home screen).
 * Never asks for permission by itself: the browser prompt only appears after
 * the farmer taps "Turn on". Same rarity rules as the install card, and never
 * on the same visit as it (claimCardSlot).
 */
export function PushPrompt() {
  const isPhone = useMediaQuery('(max-width: 767px)');
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null); // 'on' | 'blocked' | 'off' | null
  const checked = useRef(false);

  useEffect(() => {
    if (!isPhone || checked.current) return undefined;
    const timer = setTimeout(async () => {
      checked.current = true;
      const state = await pushState().catch(() => 'unavailable');
      if (state !== 'off' || !cardDue(CARD_KEY) || !claimCardSlot()) return;
      recordCardShown(CARD_KEY);
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPhone]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Close shortly after a successful "on", so the farmer sees it worked.
  useEffect(() => {
    if (result !== 'on') return undefined;
    const timer = setTimeout(close, 1800);
    return () => clearTimeout(timer);
  }, [result, close]);

  const turnOn = async () => {
    setWorking(true);
    try {
      setResult(await enablePush());
    } catch {
      setResult('error');
    } finally {
      setWorking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-card-title"
        className="absolute inset-x-3 animate-slide-up rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_24px_60px_-12px_rgba(20,25,30,0.35)] dark:border-[#2B3238] dark:bg-[#17191A] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start gap-3.5">
          <AppTile />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="push-card-title" className="font-heading text-[16px] font-bold leading-snug text-stone-950 dark:text-[#F5F7F5]">
              Get reminders on your phone
            </h2>
            <p className="mt-0.5 text-[12.5px] text-stone-500 dark:text-[#94A3B8]">
              A short alert at 7am, even when TrackFarm is closed.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-[#64748B] dark:hover:bg-[#1E2124] dark:hover:text-[#F5F7F5] cursor-pointer"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        {result === 'on' ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#F7FFE0] p-4 text-[13.5px] font-semibold text-[#4D6600] dark:bg-[#142312] dark:text-[#DFFF83]">
            <BellRing size={18} strokeWidth={2.25} aria-hidden="true" />
            Done. Reminders will now come to this phone.
          </div>
        ) : (
          <>
            <ul className="mt-5 space-y-2.5">
              <Reason icon={Syringe}>When a vaccine is due for one of your batches</Reason>
              <Reason icon={ClipboardList}>When nothing has been recorded for 2 days</Reason>
            </ul>

            {result === 'blocked' && (
              <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Notifications are blocked for TrackFarm. You can allow them later in your phone’s browser settings, then
                turn them on in Settings, Notifications.
              </p>
            )}
            {result === 'error' && (
              <p className="mt-4 text-[12px] text-red-600 dark:text-red-400">
                Couldn’t turn them on right now. Check your connection and try again.
              </p>
            )}

            <div className="mt-5 space-y-1.5">
              {result !== 'blocked' && (
                <>
                  <button type="button" onClick={turnOn} disabled={working} className={`${PRIMARY} disabled:opacity-60`}>
                    <BellRing size={18} strokeWidth={2.25} aria-hidden="true" />
                    {working ? 'Turning on…' : 'Turn on reminders'}
                  </button>
                  <p className="pb-1 text-center text-[11.5px] text-stone-400 dark:text-[#64748B]">
                    Your phone will ask you to allow notifications.
                  </p>
                </>
              )}
              <button type="button" onClick={close} className={SECONDARY}>
                {result === 'blocked' ? 'OK' : 'Not now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PushPrompt;
