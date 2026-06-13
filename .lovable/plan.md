# Offline Electron + SQLite Rewrite

## What changes
- Remove Supabase entirely from the runtime path (auth, DB, RLS).
- Add an Electron main process backed by SQLite (`better-sqlite3`) and `bcryptjs` for password hashing.
- Expose a typed `window.api` bridge via a preload script; React talks to it instead of Supabase.
- Rebuild the shell: **no sidebar**. Login → big-card Dashboard → each module has a large **Back** button.
- Cash Counter: Enter = save + silent thermal print + refocus, all in one keystroke.
- Tiny 58/80mm receipt (logo, invoice #, date, amount).
- Settings adds: printer picker, test print, change username/password, backup / restore / **Clear all data** (requires current password).

## File layout

```
electron/
  main.cjs             # window, SQLite init, IPC handlers, silent print
  preload.cjs          # exposes window.api
src/
  lib/
    db.ts              # typed wrapper around window.api (+ web stub for Lovable preview)
    auth.tsx           # local auth context (calls window.api.login)
    i18n.tsx           # kept
  components/
    layout/Shell.tsx   # header (username, lang, logout) — no sidebar
    BackButton.tsx
    ReceiptPreview.tsx # small visual; print uses hidden window
  routes/
    login.tsx
    _app/route.tsx     # auth gate, renders Shell + Outlet
    _app/index.tsx     # Dashboard with big cards
    _app/cash-counter.tsx
    _app/udhar.tsx + udhar.$id.tsx
    _app/monthly.tsx
    _app/reports.tsx
    _app/settings.tsx
```

Old `src/routes/_authenticated/*`, `src/routes/auth.tsx`, Supabase integration files, and `supabase/` migrations are removed from the user flow (Supabase files left on disk but unreferenced — safe to delete later).

## Database (SQLite)

```sql
users(id, username UNIQUE, password_hash, is_admin, created_at)
settings(key TEXT PRIMARY KEY, value TEXT)        -- shop_name, logo_data_url, language, printer_name, receipt_width
cash_transactions(id, invoice_no UNIQUE, amount, created_at)
udhar_customers(id, name, mobile, address, created_at)
udhar_transactions(id, customer_id, type CHECK(credit|payment), amount, note, entry_date, created_at)
monthly_clients(id, name, mobile, daily_qty, milk_type, rate, active, created_at)
monthly_client_transactions(id, client_id, entry_date, qty, note)
```

Seeded on first run: `admin / admin123` (bcrypt-hashed), default settings, invoice counter at 1000.

## Silent printing
- Settings → printer list pulled from `webContents.getPrintersAsync()`.
- Print path: main creates an offscreen `BrowserWindow`, loads an HTML receipt, calls `print({ silent: true, deviceName, margins:{marginType:'none'} })`.
- Receipt HTML: 58mm/80mm width via CSS, monospace, only logo + invoice # + date + amount.

## Auth
- `bcryptjs.hash` on create / change. `bcryptjs.compare` on login.
- `window.api.session` held in memory by main; React mirrors via context. Logout clears.
- Change username / password and Clear-all-data all require current password.

## Build / packaging
- `vite.config.ts`: `base: './'`.
- `package.json`: add `"main": "electron/main.cjs"`, scripts `electron:dev`, `electron:build` (vite build + @electron/packager).
- Dev deps: `electron`, `@electron/packager`, `better-sqlite3`, `bcryptjs`.
- User packages Windows installer themselves (electron-builder on Windows).

## Lovable preview behavior
Preview is browser-only — `window.api` is undefined there, so `src/lib/db.ts` falls back to a **read-only in-memory stub** that surfaces a banner: *"Running in browser preview. Install the Windows build to use the full app."* This keeps the preview from crashing while you iterate on UI.

## Out of scope (call out)
- Code signing / NSIS installer — you handle on Windows.
- Auto-update — not included.
- Multi-shop / cloud sync — explicitly removed.
