import { config } from '../config';

/**
 * Everything the app does with its service worker and the "installed app"
 * experience: registering the worker, noticing a new version, the install
 * prompt, and clearing records saved for offline use.
 */

export const UPDATE_READY_EVENT = 'farmbook:update-ready';
export const INSTALL_CHANGED_EVENT = 'farmbook:install-changed';
export const OFFLINE_DATA_EVENT = 'farmbook:offline-data';
const API_CACHE = 'farmbook-api';

let waitingWorker = null;
let installPrompt = null;

// ---- service worker + updates ----------------------------------------------

/** Production only: in dev the worker would cache Vite's modules and fight hot reload. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      tellWorkerApiBase();

      const offerUpdate = (worker) => {
        waitingWorker = worker;
        window.dispatchEvent(new Event(UPDATE_READY_EVENT));
      };

      // A new version finished downloading while this page was closed.
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          // With no controller this is the first install, not an update.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });

      // Look for a new version whenever the farmer comes back to the app.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Service worker not registered:', err);
    }
  });

  // Once the new worker takes over, reload once so the page runs the new code.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.ready.then(tellWorkerApiBase).catch(() => {});
}

/** The worker only caches reads from the API, so it needs to know where that is. */
function tellWorkerApiBase() {
  const target = navigator.serviceWorker.controller || null;
  const message = { type: 'API_BASE', apiBase: config.apiBase };
  if (target) target.postMessage(message);
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(message)).catch(() => {});
}

export function updateIsReady() {
  return Boolean(waitingWorker);
}

/** Switch to the downloaded version; the page reloads on controllerchange. */
export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}

// ---- install ---------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own mini-bar from appearing; the app offers it instead.
    e.preventDefault();
    installPrompt = e;
    window.dispatchEvent(new Event(INSTALL_CHANGED_EVENT));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    window.dispatchEvent(new Event(INSTALL_CHANGED_EVENT));
  });
}

/** True when running as the installed app rather than in a browser tab. */
export function isInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own flag.
    window.navigator.standalone === true
  );
}

function isIos() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** iPad reports itself like a Mac; its Safari keeps the Share button at the top. */
export function isIpad() {
  const ua = window.navigator.userAgent;
  return /ipad/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** iPhone/iPad Safari has no install prompt; the farmer adds it from Share. */
export function isIosSafari() {
  const ua = window.navigator.userAgent;
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIos() && safari && !isInAppBrowser();
}

/** Chrome and Edge on iOS 16.4+ can also add to the home screen from Share. */
export function isIosChrome() {
  return isIos() && /crios|edgios/i.test(window.navigator.userAgent);
}

/**
 * The browser built into WhatsApp, Facebook, Instagram and the like. Links
 * shared in a farmers' WhatsApp group often open here, and these browsers
 * can't add a site to the home screen at all.
 */
export function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|Line\/|MicroMessenger/i.test(window.navigator.userAgent);
}

/**
 * 'installed' | 'prompt' (Chrome's install dialog is ready) |
 * 'ios' (show the Share steps) | 'inapp' (open in a real browser first) |
 * 'unavailable'
 */
export function installState() {
  if (isInstalled()) return 'installed';
  if (installPrompt) return 'prompt';
  if (isInAppBrowser()) return 'inapp';
  if (isIosSafari() || isIosChrome()) return 'ios';
  return 'unavailable';
}

// ---- "Add to home screen" card: how often it may appear ---------------------
//
// After it shows, it stays away for INSTALL_CARD_GAP_DAYS, and it shows at most
// INSTALL_CARD_MAX_SHOWS times on a phone. After that only the Settings row
// offers it, so it never turns into nagging. Kept on the device: it's a
// per-phone convenience, and losing it only means the card may show again.

export const INSTALL_CARD_GAP_DAYS = 7;
export const INSTALL_CARD_MAX_SHOWS = 3;
const INSTALL_CARD_KEY = 'trackfarm_install_card';
const DAY_MS = 24 * 60 * 60 * 1000;

function readInstallCard() {
  try {
    const saved = JSON.parse(localStorage.getItem(INSTALL_CARD_KEY) || '{}');
    return { count: Number(saved.count) || 0, lastShownAt: Number(saved.lastShownAt) || 0 };
  } catch {
    return { count: 0, lastShownAt: 0 };
  }
}

/** True when the card is allowed to appear on this phone right now. */
export function installCardDue() {
  const { count, lastShownAt } = readInstallCard();
  return count < INSTALL_CARD_MAX_SHOWS && Date.now() - lastShownAt >= INSTALL_CARD_GAP_DAYS * DAY_MS;
}

/** Call once each time the card actually appears. */
export function recordInstallCardShown() {
  const { count } = readInstallCard();
  try {
    localStorage.setItem(INSTALL_CARD_KEY, JSON.stringify({ count: count + 1, lastShownAt: Date.now() }));
  } catch {
    // Storage blocked: the card may simply show again next visit.
  }
}

/** Shows the browser's install dialog. Resolves true if the farmer accepted. */
export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  window.dispatchEvent(new Event(INSTALL_CHANGED_EVENT));
  return outcome === 'accepted';
}

// ---- offline records -------------------------------------------------------

/** Called on logout so the next person on this phone never sees this farm's records. */
export async function clearOfflineRecords() {
  try {
    if ('caches' in window) await caches.delete(API_CACHE);
  } catch {
    // Storage blocked; nothing was cached.
  }
}
