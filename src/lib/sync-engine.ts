// Offline-first sync engine. Two directions:
//   PUSH: drain the local IndexedDB `outbox` table to Supabase via the
//         `apply_changes` RPC (JSONB payload keyed by cloud table names).
//   PULL: call `get_changes` for the paired business, tracking a cursor
//         in the local `sync_meta` table.
//
// Runs only when the device is online, has a Supabase session, and has been
// paired to a business via the cloud sign-in flow. Local usage (login,
// CRUD, printing) works fully with zero network — pairing is opt-in.

import { supabase } from "@/integrations/supabase/client";
import { db, type OutboxRow, type CloudTable } from "@/lib/local-db";
import { getPairing } from "@/lib/cloud";

export type PersistState = "unknown" | "granted" | "denied" | "unsupported";

export type SyncStatus = {
  online: boolean;
  paired: boolean;
  running: boolean;
  pending: number;
  failed: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  persist: PersistState;
};

// Hard limits mirroring the cloud column types, so a bad row is caught before
// it is ever sent (and named precisely when it is quarantined). A NUMERIC(p,s)
// column can hold values with an absolute value strictly below 10^(p-s).
const NUMERIC_LIMITS: Partial<Record<CloudTable, Record<string, number>>> = {
  cash_sales: { amount: 1e12 },                                   // numeric(14,2)
  udhar_entries: { amount: 1e12 },                                // numeric(14,2)
  monthly_payments: { amount: 1e12 },                             // numeric(14,2)
  monthly_clients: { daily_quantity: 1e7, rate_per_liter: 1e8 },  // (10,3) / (10,2)
  monthly_deliveries: { quantity: 1e7, rate: 1e8 },               // (10,3) / (10,2)
  purchases: { amount: 1e12, qty: 1e11, rate: 1e12 },             // (14,2)/(14,3)/(14,2)
  supplier_payments: { amount: 1e12 },                            // numeric(14,2)
  suppliers: { opening_balance: 1e12 },                           // numeric(14,2)
};

// Returns a human-readable reason when the row can never be accepted by the
// cloud schema, otherwise null.
export function validateOutboxRow(table: CloudTable, payload: Record<string, unknown>): string | null {
  const limits = NUMERIC_LIMITS[table];
  if (!limits) return null;
  for (const [field, max] of Object.entries(limits)) {
    const raw = payload[field];
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return `${table}.${field} is not a finite number (${String(raw)})`;
    if (Math.abs(n) >= max) return `${table}.${field} = ${n} is out of range for this field (must be under ${max.toLocaleString()})`;
  }
  return null;
}

async function quarantine(rows: OutboxRow[], reason: string) {
  const failed_at = new Date().toISOString();
  await db().sync_failures.bulkAdd(rows.map(r => ({ table: r.table, payload: r.payload, reason, failed_at })));
  await db().outbox.bulkDelete(rows.map(r => r.id!).filter(Boolean));
}


const CURSOR_KEY = "pull_cursor";
const DEVICE_ID_KEY = "device_id";

let state: SyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  paired: false,
  running: false,
  pending: 0,
  failed: 0,
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  persist: "unknown",
};

const listeners = new Set<(s: SyncStatus) => void>();
function emit() { for (const l of listeners) l(state); }
function patch(p: Partial<SyncStatus>) { state = { ...state, ...p }; emit(); }

export function subscribe(fn: (s: SyncStatus) => void) {
  listeners.add(fn); fn(state); return () => listeners.delete(fn);
}
export function getStatus() { return state; }

async function readMeta(key: string, fallback: string): Promise<string> {
  const row = await db().sync_meta.get(key);
  return row?.value ?? fallback;
}
async function writeMeta(key: string, value: string) {
  await db().sync_meta.put({ key, value });
}

async function deviceId(): Promise<string> {
  const existing = await readMeta(DEVICE_ID_KEY, "");
  if (existing) return existing;
  const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  await writeMeta(DEVICE_ID_KEY, id);
  return id;
}

async function refreshPending() {
  const [n, f] = await Promise.all([db().outbox.count(), db().sync_failures.count()]);
  patch({ pending: n, failed: f });
}

export async function listSyncFailures() {
  return db().sync_failures.orderBy("failed_at").reverse().limit(50).toArray();
}
export async function clearSyncFailures() {
  await db().sync_failures.clear();
  await refreshPending();
}

// Send one batch of rows. Returns the RPC error message, if any.
async function sendBatch(businessId: string, rows: OutboxRow[]): Promise<string | undefined> {
  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  for (const r of rows) {
    (grouped[r.table] ??= []).push({ ...r.payload, business_id: businessId });
  }
  const { error } = await supabase.rpc("apply_changes", {
    p_business_id: businessId,
    p_device_id: await deviceId(),
    p_changes: grouped as never,
  });
  return error?.message;
}

// Errors that mean "this data can never be accepted" — retrying forever would
// wedge the queue, so the offending row is quarantined instead.
function isPermanentDataError(msg: string) {
  return /overflow|invalid input syntax|violates|out of range|invalid type|cannot be cast/i.test(msg);
}

async function pushOnce(businessId: string): Promise<{ pushed: number; error?: string }> {
  const all: OutboxRow[] = await db().outbox.orderBy("id").limit(200).toArray();
  if (all.length === 0) return { pushed: 0 };

  // 1. Pre-flight validation: quarantine rows the cloud schema cannot hold.
  const rows: OutboxRow[] = [];
  for (const r of all) {
    const reason = validateOutboxRow(r.table, r.payload);
    if (reason) await quarantine([r], reason);
    else rows.push(r);
  }
  if (rows.length === 0) return { pushed: 0 };

  // 2. Try the whole batch. On failure, bisect to isolate the offender so one
  //    bad row cannot block every other pending change.
  const err = await sendBatch(businessId, rows);
  if (!err) {
    await db().outbox.bulkDelete(rows.map(r => r.id!).filter(Boolean));
    return { pushed: rows.length };
  }

  if (rows.length === 1) {
    const row = rows[0];
    if (isPermanentDataError(err)) {
      await quarantine(rows, err);
      return { pushed: 0, error: `Skipped 1 unsyncable ${row.table} row: ${err}` };
    }
    await db().outbox.put({ ...row, attempts: row.attempts + 1, last_error: err });
    return { pushed: 0, error: err };
  }

  const mid = Math.ceil(rows.length / 2);
  const a = await pushHalf(businessId, rows.slice(0, mid));
  const b = await pushHalf(businessId, rows.slice(mid));
  return { pushed: a.pushed + b.pushed, error: a.error ?? b.error };
}

async function pushHalf(businessId: string, rows: OutboxRow[]): Promise<{ pushed: number; error?: string }> {
  if (rows.length === 0) return { pushed: 0 };
  const err = await sendBatch(businessId, rows);
  if (!err) {
    await db().outbox.bulkDelete(rows.map(r => r.id!).filter(Boolean));
    return { pushed: rows.length };
  }
  if (rows.length === 1) {
    const row = rows[0];
    if (isPermanentDataError(err)) {
      await quarantine(rows, err);
      return { pushed: 0, error: `Skipped 1 unsyncable ${row.table} row: ${err}` };
    }
    await db().outbox.put({ ...row, attempts: row.attempts + 1, last_error: err });
    return { pushed: 0, error: err };
  }
  const mid = Math.ceil(rows.length / 2);
  const a = await pushHalf(businessId, rows.slice(0, mid));
  const b = await pushHalf(businessId, rows.slice(mid));
  return { pushed: a.pushed + b.pushed, error: a.error ?? b.error };
}


async function pullOnce(businessId: string): Promise<{ error?: string; serverTime?: string }> {
  const since = await readMeta(CURSOR_KEY, "1970-01-01T00:00:00Z");
  const { data, error } = await supabase.rpc("get_changes", {
    p_business_id: businessId,
    p_since: since,
    p_limit: 500,
  });
  if (error) return { error: error.message };
  const payload = data as Record<string, unknown> | null;
  const serverTime = (payload?.server_time as string | undefined) ?? undefined;
  if (serverTime) await writeMeta(CURSOR_KEY, serverTime);
  // NOTE: applying pulled rows back into the local integer-keyed schema
  // requires a UUID→local-id resolver; the cursor is tracked so the first
  // multi-device pull begins from the right point once that resolver ships.
  // Single-device usage (the current common case) is unaffected because
  // every write goes through the outbox.
  return { serverTime };
}

export async function syncNow() {
  if (state.running) return;
  await refreshPending();
  const pairing = getPairing();
  const { data: sess } = await supabase.auth.getSession();
  const paired = !!pairing?.business_id && !!sess.session;
  patch({ paired, running: true, lastError: null });
  if (!paired || !navigator.onLine) { patch({ running: false }); return; }
  try {
    // Drain the outbox in batches until it stops making progress.
    let total = 0; let pushErr: string | undefined;
    for (let i = 0; i < 20; i++) {
      const res = await pushOnce(pairing!.business_id!);
      total += res.pushed;
      pushErr = res.error;
      if (res.pushed === 0) break;
    }
    if (pushErr) patch({ lastError: pushErr });
    if (total) patch({ lastPushAt: new Date().toISOString() });

    const pullRes = await pullOnce(pairing!.business_id!);
    if (pullRes.error) patch({ lastError: pullRes.error });
    else patch({ lastPullAt: pullRes.serverTime ?? new Date().toISOString() });
  } catch (e) {
    patch({ lastError: (e as Error).message ?? "Sync failed" });
  } finally {
    await refreshPending();
    patch({ running: false });
  }
}

let timer: number | null = null;

async function requestPersistence(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";
  try {
    if (await navigator.storage.persisted()) return "granted";
    const granted = await navigator.storage.persist();
    return granted ? "granted" : "denied";
  } catch { return "unsupported"; }
}

export function startSync(intervalMs = 60_000) {
  if (typeof window === "undefined") return;
  stopSync();
  const setOnline = () => patch({ online: navigator.onLine });
  setOnline();
  window.addEventListener("online", () => { setOnline(); void syncNow(); });
  window.addEventListener("offline", setOnline);
  timer = window.setInterval(() => { if (navigator.onLine) void syncNow(); }, intervalMs);
  void (async () => {
    const p = await requestPersistence();
    patch({ persist: p });
    await refreshPending();
    void syncNow();
  })();
}
export function stopSync() {
  if (timer != null) { clearInterval(timer); timer = null; }
}
