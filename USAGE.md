# Milk Shop Manager — Simple User Guide

## First launch
- Double-click **MilkShopManager.exe**.
- Login: `admin` / `admin123` (change it in **Settings → Security**).
- Open **Settings → Shop Info**: enter shop name, upload logo.
- Open **Settings → Printer**: pick your thermal printer, click **Test Print**.

## Daily use — Cash Counter (fastest)
- Open **Cash Counter** from the dashboard.
- Type the amount → press **Enter**.
- Receipt prints automatically. No dialog, no clicks.

## Udhar (credit customers)
- Dashboard → **Udhar** → **Add Customer** (name + mobile).
- Open a customer → **Add Credit** (sale on credit) or **Add Payment** (money received).
- Search box on top finds any customer by name/mobile.
- **Print Ledger** button prints their full account.

## Monthly Clients (daily milk delivery)
- Dashboard → **Monthly** → **Add Client** (name, daily qty, rate, milk type).
- Every day open **Monthly → Daily Deliveries** → mark **Delivered** / **Skipped** → **Save**.
- Client not coming for a few days? Open the client → **Pause Delivery** (start & end date).
- Money received? Open the client → **Record Payment**.
- Month-end: open the client → **Print Ledger**.

## Purchases & Expenses
- Dashboard → **Purchases** → **Add Supplier** (for milk/goods suppliers).
- Record buys: open supplier → **Add Purchase** (qty × rate, cash or credit).
- Paid a supplier? Open supplier → **Add Payment**.
- Utilities / rent / transport → **Purchases → Add** with the matching **Expense category**.

## Reports
- Dashboard → **Reports → Summary**.
- Pick date range → see Sales, Udhar, Monthly, Expenses, and **Profit**.
- **Print** button gives a clean A4 report.

## Backup (do this every week)
- **Settings → Data Management → Backup Database**.
- Save the file to a USB drive.
- To restore: **Restore Database** and pick the backup file.

## Keyboard shortcuts
- **Enter** in Cash Counter → save + print.
- **Esc** → close any dialog.
- Any list has a **search box** on top — start typing.

---

# Install on your Windows PC (one-time setup)

1. Copy the project folder to your PC.
2. Install **Node.js LTS** from https://nodejs.org (once).
3. Open Command Prompt in the project folder and run:
   ```
   npm install
   npm install --save-dev electron @electron/packager
   npm install better-sqlite3 bcryptjs
   npm run build
   npx @electron/packager . MilkShopManager --platform=win32 --arch=x64 --out=release --overwrite
   ```
4. Open `release/MilkShopManager-win32-x64/` and double-click **MilkShopManager.exe**.
5. Make a desktop shortcut to that .exe. Done — no internet needed.

Your data lives at: `%APPDATA%/MilkShopManager/milkshop.db`

---

# How online sync works (optional)

The software works 100% offline. Cloud sync is an **optional** extra you turn on in Settings.

- **Offline (no internet):** every sale, udhar entry, delivery, payment, purchase is saved instantly to the local SQLite database on your PC. Nothing is lost.
- **When internet is available:**
  1. Open **Settings → Cloud Sync** once. Sign up / sign in with email + password. Create your business (or pair with an existing one).
  2. From then on, the app checks connection every 60 seconds in the background.
  3. New local entries are queued in an internal outbox and uploaded to the cloud.
  4. Changes from your other devices (another PC, phone) are pulled down and merged.
  5. Conflict rule: **last edit wins** for customers/suppliers; ledgers (sales, payments, deliveries) are **append-only** so nothing gets overwritten.
- **Internet drops mid-day:** app keeps working normally. Everything queued syncs automatically the moment internet comes back.
- **Sync status:** shown in **Settings → Cloud Sync** (last sync time, errors, manual "Sync now" button).

You never have to think about it — enter data, sync happens by itself.
