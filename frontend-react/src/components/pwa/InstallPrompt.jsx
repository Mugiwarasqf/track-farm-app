import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ExternalLink, Share, SquarePlus, Wifi, X, Zap } from 'lucide-react';
import {
  INSTALL_CHANGED_EVENT,
  installCardDue,
  installState,
  isIosSafari,
  isIpad,
  promptInstall,
  recordInstallCardShown,
} from '../../lib/pwa';
import { useMediaQuery } from '../../lib/useMediaQuery';

/** How long after the dashboard opens before the card slides up. */
const SHOW_DELAY_MS = 4000;
/** The phone states the card has something useful to say for. */
const SHOWABLE = ['prompt', 'ios', 'inapp'];

/** The TrackFarm tile, drawn like an app icon so the farmer knows what to look for. */
function AppTile() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#174b35] shadow-sm ring-1 ring-black/5">
      <img src="/images/chiken_dark.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain invert" />
    </span>
  );
}

/** One numbered step, with a picture of the real button the farmer will press. */
function Step({ number, icon: Icon, title, detail }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-700 dark:bg-[#252A2E] dark:text-[#CBD5E1]">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-stone-900 dark:text-[#F5F7F5]">{title}</div>
        {detail && <div className="text-[11.5px] text-stone-500 dark:text-[#94A3B8]">{detail}</div>}
      </div>
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-[#0a84ff] shadow-xs dark:border-[#2B3238] dark:bg-[#1E2124]">
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
    </li>
  );
}

function Benefits() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-[12px] font-medium text-stone-700 dark:bg-[#1E2124] dark:text-[#CBD5E1]">
        <Zap size={15} strokeWidth={2.25} className="shrink-0 text-[#4D6600] dark:text-[#DFFF83]" aria-hidden="true" />
        Opens in one tap
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-[12px] font-medium text-stone-700 dark:bg-[#1E2124] dark:text-[#CBD5E1]">
        <Wifi size={15} strokeWidth={2.25} className="shrink-0 text-[#4D6600] dark:text-[#DFFF83]" aria-hidden="true" />
        Works on poor network
      </div>
    </div>
  );
}

const PRIMARY =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-[#174b35] px-4 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0f3825] active:bg-[#092518] cursor-pointer';
const SECONDARY =
  'w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-[#94A3B8] dark:hover:bg-[#1E2124] dark:hover:text-[#F5F7F5] cursor-pointer';

/**
 * "Add TrackFarm to your home screen", a bottom sheet on phones.
 *
 * Browsers never let a site add itself: the farmer always has to tap. On
 * Android Chrome one tap opens Chrome's own install dialog. iPhone has no such
 * dialog, so the card shows the three Share-menu steps with pictures of the
 * real buttons. Inside WhatsApp/Facebook's built-in browser nothing can be
 * installed, so it says to open the page in Chrome or Safari first.
 *
 * Appears a few seconds after the dashboard opens, at most once every
 * INSTALL_CARD_GAP_DAYS and INSTALL_CARD_MAX_SHOWS times per phone (lib/pwa.js).
 * Any button, the X, the dimmed background or Escape closes it.
 */
export function InstallPrompt() {
  const isPhone = useMediaQuery('(max-width: 767px)');
  const [state, setState] = useState(() => installState());
  const [open, setOpen] = useState(false);
  const [delayPassed, setDelayPassed] = useState(false);
  const shownThisVisit = useRef(false);

  // Chrome's install event can arrive after the page loads, and installing
  // from elsewhere (Chrome's menu) should hide the card.
  useEffect(() => {
    const update = () => setState(installState());
    window.addEventListener(INSTALL_CHANGED_EVENT, update);
    return () => window.removeEventListener(INSTALL_CHANGED_EVENT, update);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (shownThisVisit.current || !delayPassed || !isPhone) return;
    if (!SHOWABLE.includes(state) || !installCardDue()) return;
    shownThisVisit.current = true;
    recordInstallCardShown();
    setOpen(true);
  }, [delayPassed, isPhone, state]);

  // Installed while open (e.g. from Chrome's own menu): nothing left to say.
  useEffect(() => {
    if (state === 'installed') setOpen(false);
  }, [state]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const install = async () => {
    close();
    await promptInstall();
  };

  if (!open) return null;

  const iphoneSafari = isIosSafari() && !isIpad();
  const shareWhere = isIosSafari()
    ? isIpad()
      ? 'At the top of Safari'
      : 'In the bar at the bottom of Safari'
    : 'In the address bar at the top';

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
      {/* Dimmed page behind the card: tapping it closes the card. */}
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-card-title"
        className="absolute inset-x-3 animate-slide-up rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_24px_60px_-12px_rgba(20,25,30,0.35)] dark:border-[#2B3238] dark:bg-[#17191A] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* Header: the app tile, what this is, and a close button. */}
        <div className="flex items-start gap-3.5">
          <AppTile />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="install-card-title" className="font-heading text-[16px] font-bold leading-snug text-stone-950 dark:text-[#F5F7F5]">
              {state === 'inapp' ? 'Open TrackFarm in your browser' : 'Add TrackFarm to your home screen'}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-stone-500 dark:text-[#94A3B8]">
              {state === 'inapp'
                ? 'This in-app browser can’t add apps to your phone.'
                : 'Open your farm records like any other app.'}
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

        {/* Android Chrome: one tap opens Chrome's own dialog. */}
        {state === 'prompt' && (
          <>
            <Benefits />
            <div className="mt-5 space-y-1.5">
              <button type="button" onClick={install} className={PRIMARY}>
                <SquarePlus size={18} strokeWidth={2.25} aria-hidden="true" />
                Add to home screen
              </button>
              <p className="pb-1 text-center text-[11.5px] text-stone-400 dark:text-[#64748B]">
                Your phone will ask you to confirm.
              </p>
              <button type="button" onClick={close} className={SECONDARY}>
                Not now
              </button>
            </div>
          </>
        )}

        {/* iPhone / iPad: show the three Share-menu steps. */}
        {state === 'ios' && (
          <>
            <ol className="mt-5 space-y-3.5 rounded-2xl border border-stone-100 bg-stone-50/60 p-4 dark:border-[#252A2E] dark:bg-[#1A1D1F]">
              <Step number={1} icon={Share} title="Tap the Share button" detail={shareWhere} />
              <Step number={2} icon={SquarePlus} title="Tap “Add to Home Screen”" detail="Scroll down the list if you don’t see it" />
              <Step number={3} title="Tap “Add”" detail="In the top-right corner" />
            </ol>
            <div className="mt-4">
              <button type="button" onClick={close} className={PRIMARY}>
                OK, got it
              </button>
            </div>
            {iphoneSafari && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-stone-400 dark:text-[#64748B]">
                <ArrowDown size={14} strokeWidth={2.5} className="animate-bounce" aria-hidden="true" />
                The Share button is just below this card
              </div>
            )}
          </>
        )}

        {/* WhatsApp / Facebook built-in browser: open a real browser first. */}
        {state === 'inapp' && (
          <>
            <ol className="mt-5 space-y-3.5 rounded-2xl border border-stone-100 bg-stone-50/60 p-4 dark:border-[#252A2E] dark:bg-[#1A1D1F]">
              <Step number={1} title="Tap the ⋮ or ⋯ menu" detail="Usually in a top corner of the screen" />
              <Step number={2} icon={ExternalLink} title="Choose “Open in browser”" detail="It opens in Chrome or Safari" />
              <Step number={3} title="Add it from there" detail="This card will show you how" />
            </ol>
            <div className="mt-4">
              <button type="button" onClick={close} className={PRIMARY}>
                OK, got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default InstallPrompt;
