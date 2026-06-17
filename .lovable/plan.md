# Milk Shop — Major Restructure Plan

This is a large change touching the database, Electron IPC, web stub, several routes, and printing. I'll ship it in **5 phases** so we can verify each piece works before moving on. Confirm the plan (or tell me to reorder/skip phases) and I'll start with Phase 1.

---

## Phase 1 — Database & IPC foundation

New SQLite tables (in `electron/main.cjs`) + matching localStorage stub in `src/lib/db.ts` + IPC handlers in `preload.cjs`:

- `customer_deliveries` — `id, client_id, date, default_qty, delivered_qty, rate, amount, milk_type, status (delivered|skipped), note`
- `delivery_pauses` — `id, client_id, start_date, end_date, reason`
- `customer_payments` — replaces `monthly_payments` (drop period concept; payments are just dated credits against a client)
- `purchase_categories` — `id, name, is_custom` (seeded: Milk, Dairy, Shop Supplies, Utilities, Transportation, Maintenance, Misc)
- `purchases` — replaces `purchase_entries`: `id, date, category_id, supplier_id (nullable), item_name, qty, unit, rate, amount, notes, type (purchase|payment), paid_now`
- `monthly_clients` gets `address`, `status` (already has `active`)

Migration runs on app start; old `monthly_payments` / `purchase_entries` data is preserved by copying rows where possible.

## Phase 2 — Monthly Clients rebuild

- Customer master form: name, mobile, address, milk type, default qty, rate, status.
- **Daily Delivery screen** (`/monthly/deliveries`): date picker → list of active customers with editable Actual Qty, Skip toggle, "Mark All Default", "Save All", "Print Delivery Sheet" (thermal + A4).
- **Delivery Pause** dialog on each client card.
- **Customer Ledger** (`/monthly/$clientId`): Date | Description | Debit | Credit | Balance — built from deliveries + payments + adjustments. Date-range filter + Print (full or range).
- Remove the auto `qty × rate × 30` bill. "Pending" = ledger balance.

## Phase 3 — Purchases rebuild

- Purchase entry form with Category dropdown (+ "New Category"), Item, Qty, Unit, Rate, Total, Notes, Date.
- Suppliers become optional (for credit purchases only).
- Purchase Ledger view: search, category filter, date filter, print.
- Daily / Monthly / Range purchase reports.

## Phase 4 — Reports

- Sales Report: presets (Today, Yesterday, This Week, This Month, Custom) + Print (thermal + A4).
- Purchase Report: same filters + Print.
- **Summary Report** (`/reports/summary`): one page combining Sales (cash + monthly), Udhar (new, collected, outstanding), Monthly (charges, paid, outstanding), Purchases, Expenses by category, and Profit = Sales + Other − Purchases − Expenses. Dedicated Print button with shop logo + name + date range.

## Phase 5 — Printing

Shared print helpers for:
- Customer Ledger / Monthly Bill
- Sales Report / Purchase Report / Udhar Ledger
- Summary Report
- Daily Delivery Sheet

Each uses the existing silent thermal pipeline when `printer_name` is configured; falls back to A4 browser print otherwise. A4 templates get a clean header (logo + shop name + range).

---

## Technical notes

- All offline / SQLite only — no backend changes.
- `monthly_payments` table kept read-only for back-compat; new code writes to `customer_payments`.
- i18n strings (EN/UR) added per phase.
- No UI changes to Cash Counter, Auth, Settings (silent print + printer wizard already in place).

## Open questions

1. **Old monthly bill data** — should I auto-seed one delivery row per past day from `daily_qty` so existing clients have a starting ledger, or start fresh from today?
2. **Pause behaviour on Daily Delivery screen** — hide paused clients entirely, or show them greyed-out with a "Paused" badge?
3. **Expenses vs Purchases** — treat Utilities/Transport/Maintenance as purchase categories (single table, as written above) or split into a separate `expenses` table? Single table is simpler; split is cleaner on reports.

Reply with answers (or "go") and I'll start Phase 1.