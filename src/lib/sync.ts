// Phase 2b — background sync scaffold.
// Pulls changes from cloud (safe, read-only) on an interval.
// Push (local→cloud) is stubbed until Phase 3 (UUID migration) lands, because
// local SQLite uses integer IDs while cloud tables use UUID primary keys.

import { supabase } from "@/integrations/supabase/client";
import { getPairing } from "@/lib/cloud";

const LAST_PULL_KEY = "milkshop_sync_last_pull_v1";
const DEVICE_ID_KEY = "milkshop_sync_device_id_v1";

export type SyncStatus = {
  online: boolean;
  paired: boolean;
  lastPullAt: string | null;
  lastError: string | null;
  running: boolean;
};

const listeners = new Set<(s: SyncStatus) => void>();
let state: SyncStatus = { online: true, paired: false, lastPullAt: null, lastError: null, running: false };
let timer: number | null = null;

function emit() { for (const l of listeners) l(state); }
function setState(patch: Partial<SyncStatus>) { state = { ...state, ...patch }; emit(); }

export function subscribe(fn: (s: SyncStatus) => void) {
  listeners.add(fn); fn(state); return () => listeners.delete(fn);
}
export function getStatus() { return state; }

function deviceId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + "-" + Math.random().toString(36).slice(2));
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getLastPull(): string {
  if (typeof window === "undefined") return "1970-01-01T00:00:00Z";
  return localStorage.getItem(LAST_PULL_KEY) || "1970-01-01T00:00:00Z";
}
function setLastPull(iso: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_PULL_KEY, iso);
}

async function pullOnce(): Promise<{ ok: boolean; error?: string; serverTime?: string }> {
  const pairing = getPairing();
  if (!pairing?.business_id) return { ok: false, error: "Not paired" };
  const since = getLastPull();
  const { data, error } = await supabase.rpc("get_changes", {
    p_business_id: pairing.business_id,
    p_since: since,
    p_limit: 500,
  });
  if (error) return { ok: false, error: error.message };
  const serverTime = (data as any)?.server_time as string | undefined;
  if (serverTime) setLastPull(serverTime);
  // NOTE: applying pulled rows into local SQLite requires the Phase 3 UUID
  // migration. For now we just track the cursor so first post-migration sync
  // starts from the correct point.
  return { ok: true, serverTime };
}

export async function syncNow() {
  if (state.running) return;
  const pairing = getPairing();
  const { data: sessData } = await supabase.auth.getSession();
  const paired = !!pairing?.business_id && !!sessData.session;
  setState({ paired, running: true, lastError: null });
  if (!paired) { setState({ running: false }); return; }
  try {
    const r = await pullOnce();
    if (!r.ok) setState({ lastError: r.error ?? "Sync failed" });
    else setState({ lastPullAt: r.serverTime ?? new Date().toISOString() });
  } catch (e: any) {
    setState({ lastError: e?.message ?? "Sync failed" });
  } finally {
    setState({ running: false });
  }
}

export function startSync(intervalMs = 60_000) {
  if (typeof window === "undefined") return;
  stopSync();
  const online = () => setState({ online: navigator.onLine });
  online();
  window.addEventListener("online", online);
  window.addEventListener("offline", online);
  timer = window.setInterval(() => { if (navigator.onLine) void syncNow(); }, intervalMs);
  void syncNow();
}
export function stopSync() {
  if (timer != null) { clearInterval(timer); timer = null; }
}

// Device id is exposed for future push implementation.
export const _deviceId = deviceId;
