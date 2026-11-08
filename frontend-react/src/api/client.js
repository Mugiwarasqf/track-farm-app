// Fetch wrapper ported 1:1 from app.js lines 81–152.
// Same auth header logic, same 401 retry with silent Cognito refresh.
import { config } from '../config';

// Get/set tokens from localStorage — same keys as the old app
export function getTokens() {
  return {
    idToken: localStorage.getItem('farmbook_idtoken'),
    refreshToken: localStorage.getItem('farmbook_refreshtoken'),
    farmId: localStorage.getItem('farmbook_farmid'),
  };
}

export function setTokens({ idToken, refreshToken, farmId }) {
  if (idToken) localStorage.setItem('farmbook_idtoken', idToken);
  if (refreshToken) localStorage.setItem('farmbook_refreshtoken', refreshToken);
  if (farmId) localStorage.setItem('farmbook_farmid', farmId);
}

export function clearTokens() {
  localStorage.removeItem('farmbook_idtoken');
  localStorage.removeItem('farmbook_refreshtoken');
  localStorage.removeItem('farmbook_farmid');
  localStorage.removeItem('farmbook_batchid');
  // A different account in this browser must never see this farm's records.
  clearReadCache();
}

// Separate from clearTokens(): these are the offline-fallback copies of
// the *previous* account's farm profile (AuthContext.loadFarm falls back
// to them if the API call fails, and isOnboarded reads farmbook_onboarded
// directly). Not included in clearTokens() itself since that's reused
// just for the auth session -- but leaving these behind meant a fresh
// signup in the same browser could inherit a different account's
// onboarding-complete flag and profile fields, skipping onboarding
// entirely for a brand new farm. Call this on logout AND defensively
// before a fresh signup, since an account removed server-side (e.g. an
// admin deleting a stuck Cognito user) never goes through logout() at all.
export function clearFarmProfile() {
  localStorage.removeItem('farmbook_onboarded');
  localStorage.removeItem('farmbook_farmname');
  localStorage.removeItem('farmbook_farmername');
  localStorage.removeItem('farmbook_farmlocation');
  localStorage.removeItem('farmbook_farmphone');
  localStorage.removeItem('farmbook_role');
}

// ---- offline reads ----------------------------------------------------------
//
// Every successful GET is saved on the device so the app can still show the
// farm's records with no network. This lives here, not only in the service
// worker, because the worker is registered in production builds only and
// only helps once it controls the page; this works everywhere, from the first
// load. Same cache name as the worker, so logout (clearOfflineRecords in
// lib/pwa.js) wipes both.

export const READ_CACHE = 'farmbook-api';
const CACHED_AT_HEADER = 'X-FarmBook-Cached-At';
export const OFFLINE_DATA_EVENT = 'farmbook:offline-data';

/**
 * True only when the request never reached the server. A 4xx/5xx means the
 * server answered, so it isn't an offline problem.
 */
export function isNetworkError(err) {
  if (err?.status !== undefined) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return err instanceof TypeError;
}

function canCache() {
  return typeof window !== 'undefined' && 'caches' in window;
}

async function saveRead(url, text) {
  // A controlling service worker already saves API reads itself.
  if (!canCache() || navigator.serviceWorker?.controller) return;
  try {
    const cache = await caches.open(READ_CACHE);
    await cache.put(
      url,
      new Response(text, {
        status: 200,
        headers: { 'content-type': 'application/json', [CACHED_AT_HEADER]: new Date().toISOString() },
      })
    );
  } catch {
    // Storage full or blocked: this read just isn't available offline.
  }
}

async function readSaved(url) {
  if (!canCache()) return null;
  try {
    return (await (await caches.open(READ_CACHE)).match(url)) || null;
  } catch {
    return null;
  }
}

function announceCachedAt(cachedAt) {
  if (cachedAt) window.dispatchEvent(new CustomEvent(OFFLINE_DATA_EVENT, { detail: { cachedAt } }));
}

function cognitoRegion() {
  // Used to be parsed out of apiBase's hostname (execute-api.<region>.amazonaws.com)
  // -- broke silently the moment apiBase became a custom domain (api.trackfarm.cc)
  // instead of the raw API Gateway URL, which made every silent refresh below
  // fail and log users out as soon as their idToken naturally expired. Config
  // now carries it explicitly instead of this being inferred from a URL shape.
  return config.cognitoRegion || null;
}

async function refreshIdToken() {
  const { refreshToken } = getTokens();
  if (!refreshToken) return false;
  const region = cognitoRegion();
  if (!region) return false;

  try {
    const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-amz-json-1.1',
        'x-amz-target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: config.cognitoClientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.AuthenticationResult) return false;
    setTokens({ idToken: data.AuthenticationResult.IdToken });
    return true;
  } catch {
    return false;
  }
}

// ---- short-lived read cache --------------------------------------------------
//
// Every page fetches its own records when it opens and forgets them when it
// closes, so without this, flipping between pages blanked each one and
// re-fetched everything. A GET answered in the last READ_TTL_MS is returned
// from memory instead, and identical GETs already in flight share one
// request. Any successful write empties the cache, so whatever the farmer
// just saved shows up on the next read. Records added from another device can
// take up to READ_TTL_MS to appear; a full page reload always starts fresh.

export const READ_TTL_MS = 60 * 1000;
const readCache = new Map(); // url -> { data, at }
const inFlight = new Map(); // url -> Promise of parsed data
// Bumped on every clear. A read only fills the cache if no clear happened
// while it was in flight, so a read that raced a save can't put old data back.
let cacheGeneration = 0;

/** Forget every cached read, e.g. after a write or for a manual refresh. */
export function clearReadCache() {
  readCache.clear();
  inFlight.clear();
  cacheGeneration += 1;
}

// Callers get their own copy, so a page changing what it received can't
// alter what the next page is given.
function copyOf(data) {
  return typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data));
}

// Core API call. GETs go through the read cache above; everything else, and
// the 401 retry, goes straight to request().
export function api(method, path, body, _isRetry = false) {
  if (method !== 'GET' || _isRetry) return request(method, path, body, _isRetry);

  const url = config.apiBase + path;
  const hit = readCache.get(url);
  if (hit && Date.now() - hit.at < READ_TTL_MS) return Promise.resolve(copyOf(hit.data));

  let pending = inFlight.get(url);
  if (!pending) {
    pending = request('GET', path, undefined, false, cacheGeneration).finally(() => {
      if (inFlight.get(url) === pending) inFlight.delete(url);
    });
    inFlight.set(url, pending);
  }
  return pending.then(copyOf);
}

// The network request itself — same logic as app.js api()
//
// OFFLINE BEHAVIOUR: this is a plain fetch with no queue. Offline, fetch
// rejects outright and the write is lost — the caller just surfaces an error
// toast. The blocking offline overlay was removed so connectivity loss no
// longer stops a farmer mid-entry, but that only unblocks the UI; it does not
// make writes survive being offline.
//
// The server half of offline sync already exists: POST /sync/batch takes a
// JSON Lines queue and applies each line idempotently on a client-generated
// entryId, so replaying a queue is safe. What's missing is the client half —
// persisting failed writes locally and flushing them to that endpoint on
// reconnect. src/pages/SyncPage.jsx is only a manual paste-the-payload tool
// and isn't routed.
async function request(method, path, body, _isRetry = false, generation) {
  const { idToken } = getTokens();
  const headers = { 'content-type': 'application/json' };
  if (idToken) headers.authorization = `Bearer ${idToken}`;

  const url = config.apiBase + path;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Offline: answer a read with the last copy saved on this device.
    if (method === 'GET' && isNetworkError(err)) {
      const saved = await readSaved(url);
      if (saved) {
        announceCachedAt(saved.headers.get(CACHED_AT_HEADER));
        const text = await saved.text();
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          // A damaged copy is no better than none.
        }
      }
    }
    throw err;
  }

  // Offline, the service worker answers reads with the last copy it saved
  // and stamps when that was; the offline banner shows that time.
  announceCachedAt(res.headers.get(CACHED_AT_HEADER));

  if (res.status === 401 && !_isRetry) {
    const refreshed = await refreshIdToken();
    if (refreshed) return request(method, path, body, true, generation);
    clearTokens();
    window.location.reload();
    throw new Error('session expired');
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (method === 'GET') {
    saveRead(url, text);
    // Skip copies the service worker served while offline (they carry a
    // cached-at stamp), so the next read online fetches fresh.
    if (generation === cacheGeneration && !res.headers.get(CACHED_AT_HEADER)) {
      readCache.set(url, { data, at: Date.now() });
    }
  } else {
    clearReadCache();
  }
  return data;
}

// Raw fetch for sync endpoint (body is not JSON-stringified).
//
// This used to swallow non-OK responses and return the parsed body anyway,
// which is dangerous for the offline queue: a 401 or 500 would come back
// looking like a normal response with no `results`, and a careless caller
// could treat unsent entries as delivered. It now throws like api() does.
//
// It deliberately does NOT do api()'s clearTokens()+reload() dance when a
// refresh fails. The queue flush runs in the background, and reloading the
// page underneath someone mid-entry would be hostile. It throws instead, the
// flush keeps the queued entries, and the next attempt retries.
export async function apiRaw(method, path, rawBody, _isRetry = false) {
  const { idToken } = getTokens();
  const headers = {};
  if (idToken) headers.authorization = `Bearer ${idToken}`;

  const res = await fetch(config.apiBase + path, {
    method,
    headers,
    body: rawBody,
  });

  if (res.status === 401 && !_isRetry) {
    const refreshed = await refreshIdToken();
    if (refreshed) return apiRaw(method, path, rawBody, true);
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  // The offline queue just wrote records, so cached reads are out of date.
  clearReadCache();
  return data;
}
