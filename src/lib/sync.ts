// Re-export shim: the old `src/lib/sync` module was a pull-only scaffold.
// It has been replaced by the full push/pull engine in sync-engine.ts.
// This file exists so pre-existing imports (`@/lib/sync`) keep working.
export { subscribe, syncNow, startSync, stopSync, getStatus, type SyncStatus, type PersistState } from "@/lib/sync-engine";
