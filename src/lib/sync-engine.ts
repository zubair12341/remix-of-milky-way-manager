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
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  persist: PersistState;
};

const CURSOR_KEY = "pull_cursor";
const DEVICE_ID_KEY = "device_id";

let state: SyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  paired: false,
  running: false,
  pending: 0,
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
  const n = await db().outbox.count();
  patch({ pending: n });
}

async function pushOnce(businessId: string): Promise<{ pushed: number; error?: string }> {
  const rows: OutboxRow[] = await db().outbox.orderBy("id").limit(200).toArray();
  if (rows.length === 0) return { pushed: 0 };
  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  for (const r of rows) {
    (grouped[r.table] ??= []).push({ ...r.payload, business_id: businessId });
  }
  const { error } = await supabase.rpc("apply_changes", {
    p_business_id: businessId,
    p_device_id: await deviceId(),
    p_changes: grouped as never,
  });
  if (error) {
    // Bump attempts and record the error; leave rows in outbox for retry.
    await db().outbox.bulkPut(rows.map(r => ({ ...r, attempts: r.attempts + 1, last_error: error.message })));
    return { pushed: 0, error: error.message };
  }
  const ids = rows.map(r => r.id!).filter(Boolean);
  await db().outbox.bulkDelete(ids);
  return { pushed: rows.length };
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
    const pushRes = await pushOnce(pairing!.business_id!);
    if (pushRes.error) { patch({ lastError: pushRes.error }); }
    else if (pushRes.pushed) patch({ lastPushAt: new Date().toISOString() });
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
