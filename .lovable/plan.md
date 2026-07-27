
# Pivot: Electron → Offline-First PWA

## Assumption stated up front
The current web/Cloudflare SSR path is **replaced**, not kept alongside. There is no marketing site to preserve — the whole product is the shop app. Going forward there is **one build target**: a plain Vite + React SPA that ships as an installable PWA and is also the same bundle deployed to Lovable Cloud hosting. If you actually want to keep the SSR build as a separate marketing surface, tell me now and I'll split it into two Vite configs instead.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│  React UI (unchanged routes / pages / components)   │
│      calls  →  src/lib/db.ts  (abstraction kept)    │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌───────────────┐              ┌────────────────────┐
│  Dexie (IDB)  │◄────────────►│  Outbox table (IDB)│
│  source of    │  every write │  {op,table,payload,│
│  truth        │  → row + op  │   ts, status}      │
└───────────────┘              └─────────┬──────────┘
                                         │ drain
                                         ▼
                              ┌────────────────────┐
                              │  Sync engine        │
                              │  online + ping OK   │
                              │  → Supabase upsert  │
                              │  LWW by updated_at  │
                              └────────────────────┘
```

- **Source of truth:** Dexie / IndexedDB. Every read and write goes to Dexie first, synchronously from the UI's perspective.
- **Outbox:** every mutation appends a row `{ id, entity, op: insert|update|delete, payload, local_ts, status: pending|syncing|error, error?, attempts }`.
- **Sync engine:** starts on app boot; listens to `online` event AND polls a lightweight Supabase reachability ping (since `navigator.onLine` lies). While reachable, drains outbox FIFO, per-item try/catch so one bad row doesn't stall the queue. Pulls remote changes via existing `get_changes` RPC. Conflict rule: **last-write-wins by `updated_at`** — documented in code.
- **Status UI:** small pill in the Shell header — "All changes synced" / "N pending" / "Syncing…" / "Sync error (retry)".

## Steps (in order — Electron removal is LAST)

1. **New SPA build path** — add `vite.config.ts` (plain SPA) replacing the TanStack Start SSR config; keep the same `src/routes` tree via `tanstackRouter` plugin (already proven in `vite.electron.config.ts`). Real `index.html` + `src/main.tsx` mounting `<RouterProvider>` with browser history. Output: `dist/`.
2. **PWA plumbing** — `vite-plugin-pwa` with `registerType: 'autoUpdate'`, Workbox `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` to precache the full shell. Manifest: name, short_name (Milk Shop), icons 192/512 + maskable, `display: standalone`, theme/background colors from existing branding. Register SW from a guarded wrapper (skip in Lovable preview iframe).
3. **Icons** — generate 192, 512, and 512-maskable PNGs into `public/`.
4. **Dexie schema** — `src/lib/local-db.ts` defining tables mirroring the Supabase schema currently in `src/integrations/supabase/types.ts`: `settings`, `users` (bcrypt hashes), `cash_sales`, `udhar_customers`, `udhar_entries`, `monthly_clients`, `monthly_deliveries`, `delivery_pauses`, `monthly_payments`, `suppliers`, `purchases`, `supplier_payments`, `purchase_categories`, plus `outbox` and `sync_meta`.
5. **Rewrite `src/lib/db.ts`** — same public API surface the routes/pages already call (`api().cash.add`, `api().udhar.customers`, etc.), reimplemented against Dexie. Every mutating call also appends an outbox row. Every route that currently imports it keeps working with no change to call sites.
6. **Local auth** — `bcryptjs` (pure JS, no native binaries) checking against the local `users` table; setup flow seeds the first owner user in Dexie. Works with zero network.
7. **Sync engine** — `src/lib/sync-engine.ts`: online detector (event + 30s reachability ping to Supabase REST), outbox drainer, remote puller using existing `get_changes` / `apply_changes` RPCs already in the DB (`business_id` scoped). Exposes a `useSyncStatus()` hook.
8. **Sync status pill** — added to `src/components/layout/Shell.tsx` header.
9. **Printing** — replace `window.api.print.*` calls in `src/lib/print.ts` with `window.print()` behind a print-only CSS block in `src/styles.css` (`@media print` reveals the receipt, hides the app chrome). Accepted tradeoff: browser print confirmation dialog.
10. **Verification** — build, serve, install in Chromium, DevTools → Offline, log in, create a cash sale + udhar customer + supplier, reload while still offline, re-enable network, confirm rows appear in Supabase via `supabase--read_query`. Report exactly what I verified vs. what I couldn't in this sandbox.
11. **Electron teardown (only after step 10 passes)** — delete `electron/`, `vite.electron.config.ts`, `dist-electron/`; remove `electron`, `electron-builder`, `better-sqlite3`, `@electron/rebuild`, `@electron/packager`, related scripts and the `build` block from `package.json`; update `USAGE.md` and `DESKTOP.md` to describe PWA install instead.

## What I will NOT do
- No duplicated pages/hooks/stores for a PWA vs. web fork.
- No relying on Workbox response caching as the offline data layer.
- No silent sync failures — every error is surfaced in the status pill and stays in the outbox for retry.
- No touching the abandoned Electron folder until the PWA replacement is proven end-to-end in the same session.

## Open question before I start
The Supabase `apply_changes` RPC requires a `business_id` and membership. Offline-first login uses local users, but sync needs a Supabase session. Plan: on first online sync attempt, require the shop owner to sign into Lovable Cloud once (existing `/cloud-signin` route) to pair the device with a business; after that the session token is stored and reused. Offline login continues to work with local credentials only — sync just pauses until an online Cloud session is re-established. Confirm this is acceptable, or say if you want a different pairing model.
