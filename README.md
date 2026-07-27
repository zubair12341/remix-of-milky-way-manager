# Milk Shop Manager

Offline-first PWA for milk / dairy shop management — cash counter, udhar
(credit) ledger, monthly clients, supplier purchases, and reports. Works
fully offline (Dexie / IndexedDB) and optionally syncs across devices via
a Supabase backend that you own.

---

## 1. Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:8080. First launch shows a Setup wizard: create
the shop owner account (bcrypt-hashed, stored locally in IndexedDB). All
subsequent screens work with zero network.

Production preview:

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ on :4173, service worker active
```

---

## 2. Architecture at a glance

```
UI (React + TanStack Router)
        │
        ▼
src/lib/db.ts     ── typed API surface used by every screen
        │
        ▼
Dexie (IndexedDB)          ← source of truth, always local
  ├── domain tables (cash, udhar_*, monthly_*, purchases, suppliers, …)
  └── outbox                ← every mutation is appended here with
                              { table, payload, sync_uuid, sync_version }
        │
        ▼
src/lib/sync-engine.ts     ← runs when online + paired
  ├── PUSH: drains outbox → supabase.rpc("apply_changes", …)
  └── PULL: cursor + supabase.rpc("get_changes", since, limit)
        │
        ▼
Supabase (your project)
  ├── tables mirror Dexie schema, keyed by business_id
  ├── RLS: is_business_member(business_id) or owner_user_id = auth.uid()
  └── SECURITY DEFINER RPCs: apply_changes, get_changes
```

**Cloud pairing is optional.** Local usage works without ever signing in.
When the user signs in from Settings → Cloud Sync and pairs a business,
the sync engine begins draining the outbox and pulling remote changes.

**Conflict rule.** `apply_changes` performs `INSERT … ON CONFLICT (id) DO
UPDATE … WHERE existing.sync_version <= EXCLUDED.sync_version`. Higher
`sync_version` wins; ties keep the incoming row. Every mutation bumps
`sync_version` locally before enqueue.

**Print.** All printing goes through a hidden `<iframe>` +
`contentWindow.print()` (see `src/lib/print.ts`). No native / Electron
code path.

---

## 3. Point the app at your own Supabase project

### 3a. Create the project
1. Create a new Supabase project (any region).
2. Note the **Project URL** and **publishable / anon key** from
   Project Settings → API.

### 3b. Apply the migrations
Every schema change lives in `supabase/migrations/` as ordered SQL files.
Apply them against your new project in filename order — either:

```bash
# with the Supabase CLI, linked to your project
supabase link --project-ref <your-ref>
supabase db push
```

or paste each file into the SQL editor in order:

```
20260612173733_… .sql   (legacy scaffold — safe to run; migration
20260612173759_… .sql    093857-supersede handles final state)
20260612173823_… .sql
20260712105834_… .sql   ← creates all app tables + RLS + RPCs
20260727093010_… .sql   ← adds "owner reads own business" SELECT policy
20260727093423_… .sql   ← apply_changes RPC (intermediate)
20260727093548_… .sql   ← apply_changes RPC (final — excludes created_at/updated_at)
20260727093857_… .sql   ← explicit per-table GRANTs (loop version — superseded)
<latest timestamp>_….sql ← explicit enumerated GRANTs (final; the one you want live)
```

After apply, in the SQL editor run:

```sql
select tablename from pg_tables where schemaname='public' order by 1;
```

You should see all 14 app tables (branches, business_members, businesses,
cash_sales, delivery_pauses, monthly_clients, monthly_deliveries,
monthly_payments, purchase_categories, purchases, supplier_payments,
suppliers, udhar_customers, udhar_entries).

### 3c. Auth settings (Dashboard → Authentication → Providers)
- **Email**: enabled.
- **Confirm email**: **ON** (auto-confirm OFF). Users must click the
  confirmation link before their first sign-in.
- **Google / other social providers**: optional; not required by the app.

### 3d. Nothing else to recreate
- **Edge Functions**: none.
- **Storage buckets**: none.
- **Cron / scheduled jobs**: none.
- **Realtime channels**: not used (sync is RPC-driven, not realtime).
- **Extensions beyond defaults**: none (only `pgcrypto` for `gen_random_uuid`,
  which is enabled by default on new Supabase projects).

### 3e. Point the app at it
Set these environment variables (locally in `.env`, on Vercel in Project
Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your publishable / anon key>
VITE_SUPABASE_PROJECT_ID=<your-ref>   # optional, unused at runtime
```

The client reads only `import.meta.env.VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` (see `src/integrations/supabase/client.ts`).
There are no hardcoded URLs or keys anywhere in `src/`.

### 3f. First launch against the new project
1. Open the app, complete the local Setup wizard.
2. Settings → Cloud Sync → Sign up (uses the new project).
3. Confirm your email from the inbox.
4. Sign in, create a business, pair it.
5. Watch the sync status pill drain the outbox → 0.

---

## 4. Deploy to Vercel

### 4a. Build settings
- **Framework preset**: Vite (or "Other").
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Install command**: `npm install` (default).

Both values match `package.json` (`"build": "vite build"`) and
`vite.config.ts` (`build.outDir: "dist"`).

### 4b. Environment variables
Add in Vercel → Settings → Environment Variables (Production + Preview):

| Name                              | Value                              |
| --------------------------------- | ---------------------------------- |
| `VITE_SUPABASE_URL`               | your Supabase project URL          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | your publishable / anon key        |
| `VITE_SUPABASE_PROJECT_ID`        | your project ref (optional)        |

All three are `VITE_*` and consumed at build time via `import.meta.env`,
which is exactly the pattern Vercel supports for Vite projects.

### 4c. SPA fallback
`vercel.json` at the repo root:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Vercel's rewrite engine only applies rewrites for paths that don't match
an existing file in the build output, so `/assets/*.js`, `/sw.js`,
`/manifest.webmanifest`, and every hashed asset are served directly with
correct MIME types. Only unknown paths fall through to `index.html`,
which is what SPA routing needs.

### 4d. PWA / service worker
The service worker is generated at `dist/sw.js` by `vite-plugin-pwa`.
Because the rewrite above does not intercept real files, `/sw.js` is
served with `Content-Type: application/javascript` and scope `/`, so
registration succeeds and offline reload works in production.

Registration itself lives in `src/lib/pwa-register.ts` and is refused
under `import.meta.env.DEV`, inside iframes, and on Lovable preview
hostnames. On any Vercel domain (`*.vercel.app` or your custom domain)
none of those guards trip, so the SW registers normally.

---

## 5. Troubleshooting

- **"Loading…" forever on first launch**: clear IndexedDB
  (`milkshop_pwa_v1`) from DevTools → Application, hard-reload.
- **Sync stays at "pending N"**: verify you're signed in (Settings →
  Cloud Sync) and paired to a business. Check DevTools console for the
  actual RPC error from `apply_changes` / `get_changes`.
- **`npm install` fails with 403**: only happens if `package-lock.json`
  is regenerated against a private registry. The committed lockfile
  resolves 100% from `registry.npmjs.org`; if you regenerated it, do
  `rm package-lock.json node_modules -rf && npm install`.
