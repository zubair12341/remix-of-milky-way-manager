# Milk Shop — Offline-First + Optional Cloud Sync (Revised Plan)

This revision answers the seven open points and replaces the previous architecture doc. Nothing here is implemented yet — Phase 1 starts only after you approve this version.

---

## 1. Offline is the source of truth — forever

**Rule:** SQLite on the local machine is always the primary DB. The cloud is a mirror. The app must boot, log in, sell, print, and record everything with the network cable unplugged, on day 1 and on day 3000.

### Offline login flow (exact)

Two account types live side-by-side in the local DB:

| Field | `local_users` (always exists) | `cloud_users` (only after sync is enabled) |
|---|---|---|
| Auth source | Local SQLite, Argon2id hash | Supabase Auth |
| Required for daily use | Yes | No |
| Works offline | Always | Yes, via cached token + cached password hash |

Login screen logic on every launch:

```
1. Read local_users from SQLite.
2. If username matches a local_user → verify Argon2id(password, stored_hash). Done. No network call.
3. Else if username matches a cloud_user:
     a. If online → call supabase.auth.signInWithPassword. On success, refresh
        cached_password_hash + cached_jwt + refresh_token in SQLite.
     b. If offline → verify Argon2id(password, cached_password_hash).
        Allow login. Mark session as "offline — will re-validate on reconnect".
4. Lockout, cloud outage, expired JWT, revoked refresh token → still allow
   offline login via cached hash. Sync stays paused; UI shows a yellow pill
   "Working offline — cloud sign-in failed, will retry".
```

Owner can never be locked out by a cloud problem. The only way to lose access is to forget the local password, which is recoverable via the existing local "reset via secret question / admin override" flow.

---

## 2. First-install experience (no cloud account required)

First launch wizard:

1. **Shop details** — name, address, phone, logo, currency, language.
2. **Create local administrator** — username + password (Argon2id, stored in `local_users`, role `owner`). This account works forever, offline.
3. **Cloud sync?** Two buttons:
   - **"Not now"** (default, recommended for first-time users) → app opens, fully usable. A persistent "Enable cloud backup" entry stays in Settings.
   - **"Set up cloud sync"** → opens the cloud onboarding (sign up / sign in to Supabase, create or join a business). Can be done weeks or months later — see §7.

No cloud round-trip is required to finish setup. Internet can be off during install.

---

## 3. Multi-branch readiness

Yes — the schema is designed for it from day 1, without forcing branches on single-shop users.

Every business-scoped table gets **both** `business_id` and `branch_id` from Phase 1. A single-shop install simply has one auto-created branch (`branch_id = default_branch_uuid`), invisible in the UI.

```
businesses (id, name, ...)
branches   (id, business_id, name, address, is_default)  -- 1 row on fresh install
business_members (user_id, business_id, branch_id NULL=all-branches, role)
```

All synced rows carry `business_id + branch_id`. RLS policies filter by both. When the user later turns on multi-branch in Settings:

- A "Branches" management screen appears.
- A branch switcher appears in the top bar.
- Reports gain a branch filter and "All branches" rollup.
- Inter-branch stock transfers become a new table (`stock_transfers`) — additive, no migration of existing data.

No table redesign, no UUID re-issuance, no data backfill needed later. The only cost today is one extra UUID column per table.

---

## 4. Supplier ledger (added to scope)

Promoted from "purchases module" to a first-class ledger, symmetric to the customer udhar ledger.

### Tables (all sync-enabled)

| Table | Purpose |
|---|---|
| `suppliers` | name, mobile, address, opening_balance, notes |
| `purchase_categories` | item vs expense (already exists, kept) |
| `purchases` | supplier_id (nullable for cash expenses), category_id, date, qty, unit, rate, amount, payment_mode (cash/credit), invoice_no, notes |
| `supplier_payments` | supplier_id, date, amount, mode (cash/bank/upi), reference_no, notes |
| `supplier_ledger_entries` *(view, not a table)* | unified credit/debit feed per supplier |

### Computed balances

`supplier_outstanding = SUM(purchases.amount WHERE payment_mode='credit') − SUM(supplier_payments.amount) + opening_balance`

Computed on read, never stored — same append-only safety as customer udhar.

### Screens

- `/suppliers` — list + total owed across all suppliers
- `/suppliers/$id` — profile + running ledger (date, particulars, debit, credit, balance)
- `/suppliers/$id/payment` — record payment (thermal receipt optional)
- `/reports/supplier-ledger` — per-supplier or all-suppliers, date range, A4 + thermal print
- `/reports/supplier-outstanding` — aging summary (0–30, 31–60, 60+ days)

### Sync classification

- `suppliers`, `purchase_categories` → **LWW** (master data)
- `purchases`, `supplier_payments` → **append-only ledger** (no conflicts possible across devices)

---

## 5. Mobile/Android reusability

Yes — the sync layer is designed as a transport-agnostic contract, not as Electron IPC.

### Shared contract (will live in `packages/sync-protocol` once extracted)

Two Supabase RPCs do all the work; any client that can speak HTTPS + JSON can use them:

```
POST rpc/apply_changes  { device_id, business_id, changes: [...] }
GET  rpc/get_changes    ?business_id&last_pulled_at&limit
```

- Auth: standard Supabase JWT (`Authorization: Bearer ...`) — identical on Electron and Android.
- Payload: plain JSON, no Node/Electron types.
- Storage on device: SQLite (better-sqlite3 on Electron, `androidx.sqlite` / Room or `op-sqlite` on Android/React Native).
- Same schema, same UUIDs, same outbox table, same conflict rules.

The Android app reuses: schema DDL, RPC contracts, RLS policies, conflict rules, auth flow. It reimplements only the SQLite driver and UI. No server changes when mobile ships.

---

## 6. Linking existing local data to a cloud business (deferred onboarding)

This is the migration that runs the first time the user clicks **Settings → Enable cloud sync** on a shop that has been running offline for weeks or months.

### Step-by-step

1. **Sign in / sign up** to Supabase (email+password or Google).
2. **Create a new business** *or* **join existing** with an invite code.
   - The cloud `business_id` is written to a new local row in `businesses`.
3. **Assign UUIDs.** Every existing local row already has a UUID (added in Phase 1), so this step is free. The local `legacy_id` (old integer PK) is kept for FK rewiring and debugging.
4. **Stamp ownership.** A single transaction sets `business_id = <new-uuid>` and `branch_id = <default-branch-uuid>` on every business-scoped row.
5. **Link accounts.** The local administrator is linked to the cloud user: `local_users.cloud_user_id = auth.uid()`. Future logins on this device can use either credential.
6. **Seed outbox.** Every existing row is enqueued into `sync_outbox` with op=`insert`. Push runs in the background with a progress bar ("Uploading 1,240 / 8,917 records…"). The app stays fully usable during the upload.
7. **Pull cursor.** `sync_cursors.last_pulled_at = now()` so we don't re-download what we just pushed.
8. **Snapshot backup.** Before steps 4–6 run, the app writes a timestamped copy of the SQLite file to `backups/pre-cloud-link-<timestamp>.db`. One-click restore if anything looks wrong.

### Guarantees

- No data loss: append-only ledgers + pre-link snapshot.
- No duplicates: UUIDs are stable; re-running the link is a no-op.
- No downtime: backfill runs in the background.
- Reversible within the snapshot window: restore the snapshot, delete `businesses` row, you're back to pure offline.

---

## 7. What changes vs the previous plan

| Area | Before | Now |
|---|---|---|
| First install | Implicitly assumed cloud sign-up | Local admin only; cloud is opt-in |
| Login | Cloud-first with offline fallback | **Local-first always**; cloud is a parallel account type |
| Branches | Not addressed | `branch_id` on every synced table from Phase 1 |
| Suppliers | Purchases module only | Full ledger: suppliers, purchases, payments, outstanding, aging report |
| Mobile | Mentioned as possible | Explicit shared RPC contract, schema, and auth flow |
| Cloud onboarding | Assumed at install time | Deferred onboarding flow with snapshot + background backfill |

---

## 8. Revised phases

- **Phase 1 — Local foundation (no cloud yet)**
  - Add `uuid`, `business_id`, `branch_id`, `created_at`, `updated_at`, `deleted_at`, `sync_status`, `sync_version`, `client_id` columns to every table.
  - New local tables: `local_users`, `businesses` (1 row), `branches` (1 row), `sync_outbox`, `sync_cursors`, `devices`.
  - Wrap every write in `src/lib/db.ts` to also enqueue an outbox row.
  - **First-install wizard** with local-admin creation, no cloud step.
  - Supplier ledger screens + tables.
  - Ship. App still works 100% offline; outbox just accumulates harmlessly.

- **Phase 2 — Cloud schema & opt-in onboarding**
  - Supabase: `businesses`, `business_members`, `branches`, and mirrors of every synced table with RLS by `business_id`.
  - `apply_changes` + `get_changes` RPCs.
  - Settings → "Enable cloud sync" wizard (sign-up/sign-in, create/join business, snapshot, backfill).
  - Cloud users cached locally for offline login.

- **Phase 3 — Background sync worker**
  - Push/pull loop in Electron main, exponential backoff, status pill, `/sync` dashboard, optional Realtime.

- **Phase 4 — Hardening & mobile prep**
  - Device management, weekly cloud dump, nightly local backups, restore flow.
  - Extract `packages/sync-protocol` (schema + RPC types + conflict rules) so the future Android app consumes the same contract.

---

## 9. Risks (updated)

- **Long-deferred backfill.** A shop with 2 years of offline data may push 100k+ rows. Mitigation: chunked push (500 rows/batch), progress UI, runs in background, fully resumable from the outbox.
- **Local-admin password loss.** Mitigation: existing reset flow + optional security question set during first-install wizard.
- **Branch toggle later.** Mitigation: `branch_id` already present, default branch already created — flipping the toggle just reveals UI.
- All previously listed risks (clock skew, money-safety, outbox growth, Supabase outage, schema drift) still apply with the same mitigations.

---

Approve this revision and I'll start Phase 1: schema columns, local users, first-install wizard, and supplier ledger — all still 100% offline, no cloud code yet.
