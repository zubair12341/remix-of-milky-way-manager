
# Offline-First + Online Sync — Architecture Plan

This is an architecture proposal only. No code will change until you approve.

## 1. Current state (what we're upgrading)

- Electron desktop app, SQLite via `electron/main.cjs` + IPC in `preload.cjs`.
- Web fallback uses `localStorage` shim in `src/lib/db.ts`.
- Auth is local (username/password stored on device).
- Modules: Cash Sales, Udhar, Monthly Deliveries, Purchases/Expenses, Reports, Settings.
- The project already has Lovable Cloud (Supabase) provisioned but unused by the desktop flows.

The goal is to keep every existing screen working with zero internet, while adding a background sync layer that mirrors data to the cloud so multiple devices (shop PC, home PC, laptop, future mobile) share one business.

## 2. Recommended architecture

**Option A — SQLite (local source of truth) + Supabase (Lovable Cloud) + custom sync worker.**

```text
 UI (React)
    │  (always reads/writes local first)
    ▼
 Local SQLite  ──►  outbox table (change log)
    ▲                       │
    │                       ▼
    │              Sync Worker (Electron main)
    │            ┌──────────┴───────────┐
    │            ▼                       ▼
    │      Push changes            Pull changes
    │      (REST/RPC)              (since cursor)
    │            └──────────┬───────────┘
    │                       ▼
    └──────────────  Supabase (Postgres + RLS)
```

Why A over the alternatives:

- **A. SQLite + Supabase** ✅ recommended. Supabase is already wired into the project, gives us Postgres + Auth + RLS + Realtime + Storage for free, and works fine as a sync backend via REST/RPC. Lowest build cost.
- **B. SQLite + raw Postgres.** Same DB but we'd have to build auth, API, hosting, RLS tooling ourselves. Months of extra work for no real benefit.
- **C. SQLite + custom sync API.** Maximum control, maximum cost. Only worth it if Supabase ever became a blocker — it isn't here.
- **D. CRDT (Yjs/Automerge) or RxDB/PowerSync/ElectricSQL.** Cleaner conflict story but adds a heavy runtime and changes the data model. Overkill for a single-shop app with low write contention. Keep as a future option if we ever go true multi-writer realtime.

**Final pick:** Option A.

## 3. Offline-first data flow

Every write goes through one function:

1. Generate `uuid` client-side, stamp `updated_at = now()`, `sync_status = 'pending'`.
2. Write to local SQLite inside a transaction.
3. Append a row to a local `sync_outbox` table: `{id, table, op (insert|update|delete), payload, created_at, attempts, last_error}`.
4. Return to UI immediately — UI never waits on network.
5. Sync worker drains the outbox in the background when online.

Reads always come from SQLite. The UI does not know or care whether sync is online.

## 4. Sync strategy

**Push (local → cloud):**
- Worker pulls oldest N outbox rows, sends as a batch to a Supabase RPC (`apply_changes`).
- RPC validates user + business ownership and upserts rows.
- On success: mark outbox rows done (delete), set `sync_status='synced'` on the entity.
- On failure: increment `attempts`, store `last_error`, exponential backoff (5s, 30s, 2m, 10m, 1h, capped).

**Pull (cloud → local):**
- Per-table cursor `last_pulled_at` stored locally.
- Worker calls `get_changes(table, since=last_pulled_at)`; server returns rows where `updated_at > since` (including soft-deletes).
- Apply with "server wins if server.updated_at > local.updated_at AND local row is not pending"; otherwise keep local and let push resolve it.
- Advance cursor to max `updated_at` seen.

**Deletions:** soft-delete via `deleted_at`. Hard purge after 30 days server-side. This is what makes deletes sync reliably.

**Triggers for sync:** app start, network regained (`navigator.onLine` + heartbeat ping), after every local write (debounced 2s), and a 60s interval as safety net. Optional: Supabase Realtime for near-instant pull on other devices.

## 5. Conflict resolution

Default: **Last-Write-Wins per row** using `updated_at` (UTC, server-issued on apply, local clock as tiebreaker via `client_id`).

Exceptions where LWW is wrong:

- **Monetary ledgers** (cash_sales, udhar_entries, customer_payments, deliveries, purchases): treat as **append-only events**. Two devices recording sales never conflict — both rows land. Edits to an existing entry become a new "adjustment" row, not an overwrite. This is the safest model for money.
- **Master data** (customers, suppliers, monthly_clients, settings): LWW is fine; collisions are rare and low-impact.
- **Aggregates** (bills, balances): never sync raw; recompute from events on read.

Result: real conflicts are limited to the customer/supplier/settings tables, and a stale overwrite there is recoverable from history.

## 6. Authentication

Recommendation: **Cloud auth as the source of truth, with an offline cache.**

- First-time login requires internet → Supabase Auth (email+password, Google).
- On success we store a long-lived offline credential locally (PBKDF2/Argon2 hash of password + cached JWT + refresh token) tied to the device.
- Subsequent logins work fully offline by verifying against the local hash.
- When online, we silently refresh the JWT; expired refresh tokens force a re-login next time the device is online.
- Each business gets a `business_id`; users belong to a business via a `business_members` table with roles (owner/staff). All RLS policies scope by `business_id`.

The existing local-only login becomes the "offline fallback" path of this same flow — no separate system.

## 7. Multi-device support

- One `business_id` per shop. Owner invites devices/users via email.
- Every synced row carries `business_id`; RLS enforces `business_id IN (select business_id from business_members where user_id = auth.uid())`.
- Devices are independent SQLite databases that converge through sync.
- Shop PC, home PC, laptop, and a future mobile app (React Native + SQLite or Expo SQLite) all use the same sync protocol.

## 8. Backup strategy

- **Local:** nightly SQLite file copy to `…/backups/YYYY-MM-DD.db`, keep 14.
- **Cloud:** the sync itself is the live backup. Plus weekly Supabase logical dump to Storage (kept 12 weeks) via a scheduled function.
- **Manual export** button in Settings → ZIP of SQLite + CSV exports.
- **Restore** flow in Settings (with password confirm).

## 9. Sync dashboard

New route `/sync` with:

- Connection state (Online/Offline, last successful ping).
- Last sync time (push + pull, per table).
- Pending count (outbox size).
- Failed count + per-row error with "Retry" and "Discard".
- "Sync Now" button.
- Toggle for auto-sync.
- Device list (other devices on this business + last-seen).

A small status pill lives in the top bar of the existing Shell.

## 10. Database changes

Every synced table gets:

```text
id           TEXT  PRIMARY KEY   -- uuid v4, generated client-side
business_id  TEXT  NOT NULL
created_at   INTEGER  (epoch ms, UTC)
updated_at   INTEGER  (epoch ms, UTC)
deleted_at   INTEGER  NULL
sync_status  TEXT  DEFAULT 'pending'  -- pending|synced|error
sync_version INTEGER DEFAULT 0          -- bumped on every local edit
client_id    TEXT                       -- device that last wrote
```

Tables to migrate (local SQLite + Supabase mirror):

- `monthly_clients`, `customer_deliveries`, `delivery_pauses`, `customer_payments`
- `udhar_customers`, `udhar_entries`
- `cash_sales`
- `suppliers`, `purchase_categories`, `purchases_v2`, `supplier_payments`
- `settings` (shop info, printer prefs — per business, not per device; device prefs stay local-only)
- New: `businesses`, `business_members`, `sync_outbox`, `sync_cursors`, `devices`

Existing integer auto-increment IDs are migrated to UUIDs with a one-time script that rewrites foreign keys; old IDs kept in a `legacy_id` column for safety.

Supabase mirror tables use the same shape, with RLS scoped by `business_id`, `GRANT` to `authenticated`, and triggers to set `updated_at = now()` server-side on apply.

## 11. Implementation phases

**Phase 1 — Foundations (no behavior change yet)**
- Add UUID + sync columns to all SQLite tables (migration with data backfill).
- Add `sync_outbox`, `sync_cursors`, `devices`, `businesses`, `business_members`.
- Wrap every write path in `src/lib/db.ts` so it also writes to `sync_outbox`.
- Ship the matching Supabase schema (migration) with RLS + `apply_changes` / `get_changes` RPCs.

**Phase 2 — Auth + business model**
- Add Supabase email/password + Google sign-in.
- First launch: create business or join one (invite code).
- Cache credentials for offline login; keep the existing local-login UI as the offline path.

**Phase 3 — Sync worker**
- Background worker in Electron main process; push, pull, backoff, conflict rules.
- `/sync` dashboard + top-bar status pill.
- Realtime subscription (optional) for fast cross-device updates.

**Phase 4 — Hardening + multi-device**
- Bulk backfill: existing single-device data gets a `business_id` and is pushed once.
- Device management, invites, role checks.
- Weekly cloud dump, local nightly backups, restore flow.
- QA matrix: offline writes, plane-mode toggles, two devices editing same customer, clock skew, large outbox drain.

Each phase ships independently; the app stays usable after every phase.

## 12. Complexity & risks

- **Complexity:** Medium-High. The sync worker, conflict rules, and UUID migration are the bulk of the work. Roughly: P1 ~1 wk, P2 ~3 days, P3 ~1.5 wk, P4 ~1 wk.
- **Risks & mitigations:**
  - *UUID migration on existing data* → run on a copied DB first, keep `legacy_id`, full backup before migrate.
  - *Clock skew across devices* → server stamps authoritative `updated_at` on apply; client clock only used as tiebreaker.
  - *Money corruption from LWW* → ledgers are append-only, never overwritten.
  - *Outbox grows during long offline periods* → batched push, size cap with paging, dashboard surfaces it.
  - *Auth lockout offline* → cached credential + cached JWT, refresh opportunistically.
  - *Supabase outage* → app keeps working; outbox drains when service returns.
  - *Schema drift between SQLite and Postgres* → single migration source generates both, CI check.

## 13. Final deliverable summary

- **Architecture:** Offline-first SQLite + background sync worker + Supabase mirror.
- **Cloud DB:** Supabase (already provisioned via Lovable Cloud).
- **Sync:** Outbox push + cursor-based pull, soft-deletes, exponential backoff, optional Realtime.
- **Conflicts:** Append-only for money; LWW for master data; recompute aggregates.
- **Auth:** Supabase Auth as source of truth, offline credential cache for zero-internet login.
- **DB changes:** UUID PKs, `business_id`, timestamps, `deleted_at`, `sync_status`, `sync_version`, `client_id`; new `businesses`, `business_members`, `sync_outbox`, `sync_cursors`, `devices`.
- **Migration:** 4 phases, each ships independently, existing data preserved via `legacy_id` and backfill.
- **Complexity:** Medium-High, ~3–4 weeks total; main risks are the UUID migration and money-safety, both mitigated above.

Approve this plan and I'll start with Phase 1 (schema + outbox plumbing) without touching any existing screens.
