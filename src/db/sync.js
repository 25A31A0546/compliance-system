/**
 * src/db/sync.js
 *
 * Offline-sync helper for the Legal Metrology Inspection app.
 *
 * How it works
 * ─────────────
 * 1. The inspections SQLite table has a `synced` column (0 = pending, 1 = done).
 * 2. On every "app becomes active" event (foreground resume), the module fires a
 *    lightweight HEAD request to check whether the FastAPI server is reachable.
 * 3. If reachable, it fetches all unsynced rows via getUnsyncedInspections(),
 *    POSTs each to POST /api/v1/inspections, and marks successful rows as synced.
 * 4. Failed rows are left with synced = 0 and will be retried on the next sync.
 *
 * Usage (in App.js)
 * ─────────────────
 *   import { startNetworkSync, stopNetworkSync } from './src/db/sync';
 *
 *   useEffect(() => {
 *     startNetworkSync();
 *     return () => stopNetworkSync();
 *   }, []);
 */

import { AppState } from 'react-native';
import axios from 'axios';
import { getUnsyncedInspections, markAsSynced } from './database';
import { API_BASE_URL, SYNC_ENDPOINT, HEALTH_ENDPOINT } from '../constants/api';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum ms to wait for the reachability probe before assuming offline. */
const PROBE_TIMEOUT_MS = 4000;

/** Maximum ms to wait for each individual POST during sync. */
const POST_TIMEOUT_MS = 10000;

// ─── Internal state ───────────────────────────────────────────────────────────

/** Prevents overlapping sync runs. */
let isSyncing = false;

/** Reference to the AppState subscription so we can remove it later. */
let appStateSubscription = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the FastAPI server responds within PROBE_TIMEOUT_MS.
 * Uses a HEAD request to avoid triggering real API logic.
 */
const isServerReachable = async () => {
  try {
    await axios.head(HEALTH_ENDPOINT, { timeout: PROBE_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
};

/**
 * Parse the `details` field from SQLite back to an object if it was stored
 * as a JSON string, otherwise return it unchanged.
 */
const parseDetails = (raw) => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

// ─── Core sync logic ──────────────────────────────────────────────────────────

/**
 * Fetch all unsynced SQLite records and POST them to the remote API.
 *
 * @returns {{ synced: number, failed: number, skipped: number }}
 */
export const syncOfflineInspections = async () => {
  if (isSyncing) {
    console.log('[Sync] Already in progress — skipping.');
    return { synced: 0, failed: 0, skipped: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getUnsyncedInspections();

    if (pending.length === 0) {
      console.log('[Sync] No unsynced records — nothing to do.');
      return { synced: 0, failed: 0, skipped: 0 };
    }

    console.log(`[Sync] Found ${pending.length} unsynced record(s). Starting upload…`);

    for (const record of pending) {
      try {
        await axios.post(
          SYNC_ENDPOINT,
          {
            id: record.id,
            product_name: record.product_name,
            status: record.status,
            details: parseDetails(record.details),
            created_at: record.created_at,
          },
          { timeout: POST_TIMEOUT_MS }
        );

        // Mark as synced in SQLite immediately after a successful POST
        await markAsSynced(record.id);
        synced++;
        console.log(`[Sync] ✓ Record ${record.id} (${record.product_name}) uploaded.`);
      } catch (postErr) {
        failed++;
        const msg = postErr?.response
          ? `HTTP ${postErr.response.status}`
          : postErr?.message || 'Unknown error';
        console.warn(`[Sync] ✗ Record ${record.id} failed: ${msg}`);
      }
    }
  } catch (dbErr) {
    console.error('[Sync] Failed to read from SQLite:', dbErr);
  } finally {
    isSyncing = false;
  }

  console.log(`[Sync] Complete — ✓ synced: ${synced}  ✗ failed: ${failed}`);
  return { synced, failed, skipped: 0 };
};

// ─── Connectivity-gated sync ──────────────────────────────────────────────────

/**
 * Check server reachability first, then run a sync if online.
 * Safe to call at any time — it will no-op if offline or already syncing.
 *
 * @returns {Promise<{ synced: number, failed: number, skipped: number }>}
 */
export const trySyncIfOnline = async () => {
  const reachable = await isServerReachable();
  if (!reachable) {
    console.log('[Sync] Server not reachable — skipping sync.');
    return { synced: 0, failed: 0, skipped: 0 };
  }
  return syncOfflineInspections();
};

// ─── App lifecycle integration ────────────────────────────────────────────────

/**
 * Register an AppState listener that triggers trySyncIfOnline() every time
 * the app transitions from background/inactive → active (i.e. user switches
 * back to the app, device screen turns on, etc.).
 *
 * Also fires an initial sync attempt immediately on call.
 *
 * Call stopNetworkSync() to tear down the listener (e.g. in a useEffect
 * cleanup function).
 */
export const startNetworkSync = () => {
  if (appStateSubscription) {
    console.log('[Sync] Listener already registered.');
    return;
  }

  console.log('[Sync] Starting network sync listener…');

  // Attempt an initial sync right away (handles records written while offline
  // before this function was first called).
  trySyncIfOnline();

  appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      console.log('[Sync] App became active — checking connectivity…');
      trySyncIfOnline();
    }
  });
};

/**
 * Remove the AppState listener registered by startNetworkSync().
 * Should be called in a useEffect cleanup to avoid memory leaks.
 */
export const stopNetworkSync = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
    console.log('[Sync] Network sync listener removed.');
  }
};
