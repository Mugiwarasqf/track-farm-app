import { api } from '../api/client';
import { config } from '../config';
import { isInstalled } from './pwa';

/**
 * Phone notifications (Web Push) for this device.
 *
 * Turning them on: ask permission (only ever from a tap — browsers penalise
 * asking on page load, and iPhone refuses), subscribe through the service
 * worker with the server's public key, then save the subscription to the
 * API. The daily reminder jobs then notify every phone saved for the farm.
 *
 * iPhone only allows this once TrackFarm is on the home screen (iOS 16.4+).
 * The service worker only runs in production builds, so locally this
 * reports 'unsupported'.
 */

export const PUSH_CHANGED_EVENT = 'trackfarm:push-changed';

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function browserSupportsPush() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** The VAPID public key, base64url, as the bytes PushManager wants. */
function keyBytes(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  // Only resolves once a worker is active; production builds only.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  return reg || null;
}

async function currentSubscription() {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function announce() {
  window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));
}

/**
 * 'unavailable'   not set up on this deploy, or no service worker (dev)
 * 'unsupported'   this browser can't do push
 * 'needs-install' iPhone: add to home screen first
 * 'blocked'       the farmer said no; only phone settings can undo that
 * 'off'           can be turned on with a tap
 * 'on'            this phone gets notifications
 */
export async function pushState() {
  if (!config.vapidPublicKey) return 'unavailable';
  if (isIos() && !isInstalled()) return 'needs-install';
  if (!browserSupportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  if (!reg) return 'unavailable';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Turn on for this phone. Call only from a tap. Resolves to the new state. */
export async function enablePush() {
  if (!config.vapidPublicKey || !browserSupportsPush()) return pushState();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    announce();
    return permission === 'denied' ? 'blocked' : 'off';
  }

  const reg = await registration();
  if (!reg) return 'unavailable';
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(config.vapidPublicKey),
    });
  }
  await api('POST', '/push/subscriptions', sub.toJSON());
  announce();
  return 'on';
}

/** Turn off for this phone: stop the browser subscription and tell the server. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    const { endpoint } = sub;
    await sub.unsubscribe().catch(() => {});
    await api('POST', '/push/subscriptions/remove', { endpoint }).catch(() => {});
  }
  announce();
  return pushState();
}

/**
 * On logout, before the login token is cleared: this phone should stop
 * getting the farm's reminders. Never holds logout up for more than ~3s,
 * e.g. with no network.
 */
export async function removePushOnLogout() {
  if (!browserSupportsPush()) return;
  await Promise.race([
    disablePush().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

/**
 * Re-save the subscription when the app opens. Browsers occasionally rotate
 * subscriptions, and this also re-links the phone if the server row was
 * cleaned up. Silent and cheap: one POST, only when already turned on.
 */
export async function refreshPushSubscription() {
  try {
    if (!config.vapidPublicKey || !browserSupportsPush() || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (sub) await api('POST', '/push/subscriptions', sub.toJSON());
  } catch {
    // Offline or not signed in: try again next time the app opens.
  }
}
