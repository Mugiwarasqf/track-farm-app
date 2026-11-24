import { lazy } from 'react';

/**
 * The signed-in app's pages, each in its own file that downloads when first
 * opened. The landing, login and signup pages stay in the main bundle (App.jsx
 * imports them directly) so a first visit on slow mobile data only downloads
 * what it shows.
 *
 * Offline: a page file the phone has never downloaded can't load without
 * network, so prefetchAppPages() pulls all of them in quietly after login.
 * The service worker caches /assets/ files as they're fetched, so every page
 * then opens offline just like before the split.
 */

const RELOAD_FLAG = 'trackfarm_chunk_reload';

/**
 * After a deploy, an app left open still asks for the old page files, which
 * no longer exist. Reload once to pick up the new version instead of showing
 * an error; the flag stops a reload loop if the file is truly unreachable
 * (e.g. offline and never cached).
 */
function load(importer, name) {
  return importer()
    .then((module) => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // storage blocked: nothing to clear
      }
      return { default: module[name] };
    })
    .catch((err) => {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        alreadyReloaded = true;
      }
      if (!alreadyReloaded && navigator.onLine !== false) {
        window.location.reload();
        return new Promise(() => {}); // keep showing the loader until the reload
      }
      throw err;
    });
}

const importers = {
  OnboardingPage: () => import('../pages/OnboardingPage'),
  ForgotPasswordPage: () => import('../pages/ForgotPasswordPage'),
  DashboardPage: () => import('../pages/DashboardPage'),
  CreateBatchPage: () => import('../pages/CreateBatchPage'),
  BatchDetailPage: () => import('../pages/BatchDetailPage'),
  BatchesPage: () => import('../pages/BatchesPage'),
  HistoryPage: () => import('../pages/HistoryPage'),
  BatchHistoryDetailPage: () => import('../pages/BatchHistoryDetailPage'),
  InventoryPage: () => import('../pages/InventoryPage'),
  SettingsPage: () => import('../pages/SettingsPage'),
  NotificationsPage: () => import('../pages/NotificationsPage'),
};

export const OnboardingPage = lazy(() => load(importers.OnboardingPage, 'OnboardingPage'));
export const ForgotPasswordPage = lazy(() => load(importers.ForgotPasswordPage, 'ForgotPasswordPage'));
export const DashboardPage = lazy(() => load(importers.DashboardPage, 'DashboardPage'));
export const CreateBatchPage = lazy(() => load(importers.CreateBatchPage, 'CreateBatchPage'));
export const BatchDetailPage = lazy(() => load(importers.BatchDetailPage, 'BatchDetailPage'));
export const BatchesPage = lazy(() => load(importers.BatchesPage, 'BatchesPage'));
export const HistoryPage = lazy(() => load(importers.HistoryPage, 'HistoryPage'));
export const BatchHistoryDetailPage = lazy(() => load(importers.BatchHistoryDetailPage, 'BatchHistoryDetailPage'));
export const InventoryPage = lazy(() => load(importers.InventoryPage, 'InventoryPage'));
export const SettingsPage = lazy(() => load(importers.SettingsPage, 'SettingsPage'));
export const NotificationsPage = lazy(() => load(importers.NotificationsPage, 'NotificationsPage'));

let prefetched = false;

/**
 * Download every signed-in page in the background, a few seconds after the
 * app opens, so they're ready (and cached for offline) before they're tapped.
 * It's the same code the app used to download all at once on first load,
 * just moved off the critical path.
 */
export function prefetchAppPages() {
  if (prefetched || navigator.onLine === false) return;
  prefetched = true;
  const run = () => {
    for (const [key, importer] of Object.entries(importers)) {
      if (key === 'OnboardingPage' || key === 'ForgotPasswordPage') continue;
      importer().catch(() => {
        prefetched = false; // try again next time the app opens
      });
    }
  };
  const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  setTimeout(() => schedule(run), 2500);
}
