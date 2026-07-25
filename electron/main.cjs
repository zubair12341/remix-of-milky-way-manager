// Electron main process — Milk Shop Manager
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let Database, bcrypt;
try { Database = require("better-sqlite3"); } catch (e) { console.error("better-sqlite3 missing"); throw e; }
try { bcrypt = require("bcryptjs"); } catch (e) { console.error("bcryptjs missing"); throw e; }

const userDataDir = app.getPath("userData");
if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
const dbPath = path.join(userDataDir, "milkshop.db");

// ---- Pre-launch backup (Phase 1) ----
// Snapshot the SQLite file before any ALTER/CREATE runs. Keeps most recent 10.
try {
  if (fs.existsSync(dbPath)) {
    const backupDir = path.join(userDataDir, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const target = path.join(backupDir, `milkshop-prelaunch-${ts}.db`);
    fs.copyFileSync(dbPath, target);
    for (const ext of ["-wal", "-shm"]) {
      const src = dbPath + ext;
      if (fs.existsSync(src)) fs.copyFileSync(src, target + ext);
    }
    const snaps = fs.readdirSync(backupDir).filter(f => f.startsWith("milkshop-prelaunch-") && f.endsWith(".db")).sort();
    while (snaps.length > 10) {
      const old = snaps.shift();
      try { fs.unlinkSync(path.join(backupDir, old)); } catch {}
      for (const ext of ["-wal", "-shm"]) { try { fs.unlinkSync(path.join(backupDir, old + ext)); } catch {} }
    }
  }
} catch (e) { console.error("Pre-launch backup failed (non-fatal):", e); }

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const uuid = () => crypto.randomUUID();

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS cash_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no INTEGER NOT NULL UNIQUE, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS udhar_customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mobile TEXT, address TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS udhar_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES udhar_customers(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type IN ('credit','payment')), amount REAL NOT NULL, note TEXT, entry_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS monthly_clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mobile TEXT, daily_qty REAL NOT NULL DEFAULT 0, milk_type TEXT NOT NULL DEFAULT 'cow', rate REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS monthly_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES monthly_clients(id) ON DELETE CASCADE, period TEXT NOT NULL, amount REAL NOT NULL, note TEXT, entry_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS customer_deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES monthly_clients(id) ON DELETE CASCADE, entry_date TEXT NOT NULL, default_qty REAL NOT NULL DEFAULT 0, delivered_qty REAL NOT NULL DEFAULT 0, rate REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0, milk_type TEXT, status TEXT NOT NULL DEFAULT 'delivered' CHECK(status IN ('delivered','skipped')), note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(client_id, entry_date));
CREATE TABLE IF NOT EXISTS delivery_pauses (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES monthly_clients(id) ON DELETE CASCADE, start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mobile TEXT, address TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS purchase_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'item' CHECK(kind IN ('item','expense')), is_custom INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS purchases_v2 (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_date TEXT NOT NULL, category_id INTEGER REFERENCES purchase_categories(id) ON DELETE SET NULL, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, item_name TEXT, qty REAL, unit TEXT, rate REAL, amount REAL NOT NULL DEFAULT 0, paid_now REAL NOT NULL DEFAULT 0, type TEXT NOT NULL DEFAULT 'purchase' CHECK(type IN ('purchase','payment')), note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS purchase_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type IN ('purchase','payment')), amount REAL NOT NULL, qty REAL, rate REAL, note TEXT, entry_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));

-- ===== Phase 1 sync-ready tables (UUID PKs + audit fields) =====
CREATE TABLE IF NOT EXISTS suppliers_v2 (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, mobile TEXT, address TEXT,
  opening_balance REAL NOT NULL DEFAULT 0, notes TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT, updated_by TEXT
);
CREATE TABLE IF NOT EXISTS purchases_v3 (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers_v2(id) ON DELETE SET NULL,
  entry_date TEXT NOT NULL, invoice_no TEXT, item_name TEXT,
  qty REAL, unit TEXT, rate REAL, amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'credit' CHECK(payment_mode IN ('cash','credit')),
  notes TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT, updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchases_v3_supplier ON purchases_v3(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_v3_date ON purchases_v3(entry_date);
CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers_v2(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL, amount REAL NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cash' CHECK(mode IN ('cash','bank','upi','cheque','other')),
  reference_no TEXT, notes TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT, updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(entry_date);
`);

// Idempotent ALTERs
try { db.exec("ALTER TABLE monthly_clients ADD COLUMN address TEXT"); } catch {}

// Seed default categories
const catCount = db.prepare("SELECT COUNT(*) c FROM purchase_categories").get().c;
if (catCount === 0) {
  const ins = db.prepare("INSERT INTO purchase_categories (name, kind) VALUES (?, ?)");
  [["Milk Purchase","item"],["Dairy Products","item"],["Shop Supplies","item"],["Miscellaneous","item"],
   ["Utilities","expense"],["Transportation","expense"],["Maintenance","expense"],["Other Expense","expense"]
  ].forEach(([n,k]) => ins.run(n,k));
}

// Seed admin (used until first-install wizard completes)
if (db.prepare("SELECT COUNT(*) c FROM users").get().c === 0) {
  db.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)").run("admin", bcrypt.hashSync("admin123", 10));
}
const defaults = { shop_name: "Milk Shop", logo_data_url: "", language: "en", printer_name: "", receipt_width: "80", invoice_counter: "1000" };
const setStmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(defaults)) setStmt.run(k, v);

// First-install flag — auto-mark complete on installs that already have data
{
  const flag = db.prepare("SELECT value FROM settings WHERE key='first_install_complete'").get();
  if (!flag) {
    const n = db.prepare(`SELECT
      (SELECT COUNT(*) FROM cash_transactions) +
      (SELECT COUNT(*) FROM udhar_customers) +
      (SELECT COUNT(*) FROM monthly_clients) +
      (SELECT COUNT(*) FROM suppliers) +
      (SELECT COUNT(*) FROM purchases_v2) AS n`).get().n;
    if (n > 0) db.prepare("INSERT INTO settings (key,value) VALUES ('first_install_complete','1')").run();
  }
}


let session = null;
const getSetting = (k) => { const r = db.prepare("SELECT value FROM settings WHERE key=?").get(k); return r ? r.value : null; };
const setSetting = (k, v) => db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, String(v ?? ""));
const getAllSettings = () => Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(r => [r.key, r.value]));

// ---- Auth ----
ipcMain.handle("auth:login", (_e, { username, password }) => {
  const u = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return { ok: false, error: "Invalid credentials" };
  session = { id: u.id, username: u.username };
  return { ok: true, user: session };
});
ipcMain.handle("auth:session", () => session);
ipcMain.handle("auth:logout", () => { session = null; return { ok: true }; });
ipcMain.handle("auth:change", (_e, { currentPassword, newUsername, newPassword }) => {
  if (!session) return { ok: false, error: "Not logged in" };
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(session.id);
  if (!u || !bcrypt.compareSync(currentPassword, u.password_hash)) return { ok: false, error: "Current password is wrong" };
  const username = (newUsername || u.username).trim();
  const hash = newPassword ? bcrypt.hashSync(newPassword, 10) : u.password_hash;
  try { db.prepare("UPDATE users SET username=?, password_hash=? WHERE id=?").run(username, hash, u.id); } catch (e) { return { ok: false, error: e.message }; }
  session = { id: u.id, username };
  return { ok: true, user: session };
});

// ---- Settings ----
ipcMain.handle("settings:getAll", () => getAllSettings());
ipcMain.handle("settings:set", (_e, { key, value }) => { setSetting(key, value); return { ok: true }; });
ipcMain.handle("settings:getPrinters", async () => {
  try { const win = BrowserWindow.getAllWindows()[0]; const list = await win.webContents.getPrintersAsync(); return list.map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault, status: p.status })); } catch { return []; }
});

// ---- Cash ----
ipcMain.handle("cash:add", (_e, { amount }) => {
  const counter = parseInt(getSetting("invoice_counter") || "1000", 10) + 1;
  const info = db.prepare("INSERT INTO cash_transactions (invoice_no, amount) VALUES (?, ?)").run(counter, Number(amount));
  setSetting("invoice_counter", String(counter));
  return db.prepare("SELECT * FROM cash_transactions WHERE id=?").get(info.lastInsertRowid);
});
ipcMain.handle("cash:recent", (_e, { limit = 20 } = {}) => db.prepare("SELECT * FROM cash_transactions ORDER BY id DESC LIMIT ?").all(limit));
ipcMain.handle("cash:todayTotal", () => db.prepare("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM cash_transactions WHERE date(created_at)=?").get(new Date().toISOString().slice(0,10)));
ipcMain.handle("cash:range", (_e, { from, to }) => db.prepare("SELECT date(created_at) day, COALESCE(SUM(amount),0) total FROM cash_transactions WHERE date(created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day").all(from, to));
ipcMain.handle("cash:sum", (_e, { from, to }) => db.prepare("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM cash_transactions WHERE date(created_at) BETWEEN ? AND ?").get(from, to));

// ---- Udhar ----
ipcMain.handle("udhar:customers", () => db.prepare(`SELECT c.*, COALESCE((SELECT SUM(CASE WHEN type='credit' THEN amount ELSE -amount END) FROM udhar_transactions WHERE customer_id=c.id),0) balance FROM udhar_customers c ORDER BY c.name`).all());
ipcMain.handle("udhar:customer", (_e, { id }) => db.prepare("SELECT * FROM udhar_customers WHERE id=?").get(id));
ipcMain.handle("udhar:addCustomer", (_e, { name, mobile, address }) => { const i = db.prepare("INSERT INTO udhar_customers (name,mobile,address) VALUES (?,?,?)").run(name, mobile||null, address||null); return db.prepare("SELECT * FROM udhar_customers WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("udhar:deleteCustomer", (_e, { id }) => { db.prepare("DELETE FROM udhar_customers WHERE id=?").run(id); return { ok: true }; });
ipcMain.handle("udhar:entries", (_e, { customerId }) => db.prepare("SELECT * FROM udhar_transactions WHERE customer_id=? ORDER BY entry_date DESC, id DESC").all(customerId));
ipcMain.handle("udhar:addEntry", (_e, { customerId, type, amount, note, entry_date }) => { const i = db.prepare("INSERT INTO udhar_transactions (customer_id,type,amount,note,entry_date) VALUES (?,?,?,?,?)").run(customerId, type, Number(amount), note||null, entry_date||new Date().toISOString().slice(0,10)); return db.prepare("SELECT * FROM udhar_transactions WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("udhar:totals", (_e, { from, to }) => {
  const cr = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM udhar_transactions WHERE type='credit' AND entry_date BETWEEN ? AND ?").get(from, to).v;
  const pm = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM udhar_transactions WHERE type='payment' AND entry_date BETWEEN ? AND ?").get(from, to).v;
  const out = db.prepare("SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0) v FROM udhar_transactions").get().v;
  return { credit: cr, payment: pm, outstanding: out };
});

// ---- Monthly clients ----
function clientBalance(clientId) {
  const charges = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM customer_deliveries WHERE client_id=?").get(clientId).v;
  const paid = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM monthly_payments WHERE client_id=?").get(clientId).v;
  return { charges, paid, balance: charges - paid };
}
ipcMain.handle("monthly:list", () => {
  const period = new Date().toISOString().slice(0, 7);
  const rows = db.prepare("SELECT * FROM monthly_clients ORDER BY name").all();
  return rows.map(c => {
    const b = clientBalance(c.id);
    const monthDel = db.prepare("SELECT COALESCE(SUM(amount),0) v, COALESCE(SUM(delivered_qty),0) q FROM customer_deliveries WHERE client_id=? AND entry_date LIKE ?").get(c.id, period+"%");
    const paidMonth = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM monthly_payments WHERE client_id=? AND period=?").get(c.id, period).v;
    const pause = db.prepare("SELECT * FROM delivery_pauses WHERE client_id=? AND date('now') BETWEEN start_date AND end_date ORDER BY id DESC LIMIT 1").get(c.id);
    return { ...c, month_amount: monthDel.v, month_qty: monthDel.q, paid_this_month: paidMonth, paid_total: b.paid, total_charges: b.charges, balance: b.balance, paused: pause ? 1 : 0, pause_end: pause ? pause.end_date : null };
  });
});
ipcMain.handle("monthly:add", (_e, c) => { const i = db.prepare("INSERT INTO monthly_clients (name,mobile,address,daily_qty,milk_type,rate,active) VALUES (?,?,?,?,?,?,?)").run(c.name, c.mobile||null, c.address||null, Number(c.daily_qty||0), c.milk_type||'cow', Number(c.rate||0), c.active==0?0:1); return db.prepare("SELECT * FROM monthly_clients WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("monthly:update", (_e, { id, ...c }) => { db.prepare("UPDATE monthly_clients SET name=?, mobile=?, address=?, daily_qty=?, milk_type=?, rate=?, active=? WHERE id=?").run(c.name, c.mobile||null, c.address||null, Number(c.daily_qty||0), c.milk_type, Number(c.rate||0), c.active?1:0, id); return { ok: true }; });
ipcMain.handle("monthly:delete", (_e, { id }) => { db.prepare("DELETE FROM monthly_clients WHERE id=?").run(id); return { ok: true }; });
ipcMain.handle("monthly:client", (_e, { id }) => { const c = db.prepare("SELECT * FROM monthly_clients WHERE id=?").get(id); if (!c) return null; return { ...c, ...clientBalance(id) }; });

// Deliveries
ipcMain.handle("monthly:deliveries", (_e, { from, to, clientId }) => {
  if (clientId) return db.prepare("SELECT * FROM customer_deliveries WHERE client_id=? AND entry_date BETWEEN ? AND ? ORDER BY entry_date DESC, id DESC").all(clientId, from||"0000-01-01", to||"9999-12-31");
  return db.prepare("SELECT * FROM customer_deliveries WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date DESC, id DESC").all(from||"0000-01-01", to||"9999-12-31");
});
ipcMain.handle("monthly:deliveriesForDate", (_e, { date }) => db.prepare("SELECT * FROM customer_deliveries WHERE entry_date=?").all(date));
ipcMain.handle("monthly:saveDeliveries", (_e, { date, rows }) => {
  const upsert = db.prepare(`INSERT INTO customer_deliveries (client_id,entry_date,default_qty,delivered_qty,rate,amount,milk_type,status,note) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(client_id,entry_date) DO UPDATE SET default_qty=excluded.default_qty, delivered_qty=excluded.delivered_qty, rate=excluded.rate, amount=excluded.amount, milk_type=excluded.milk_type, status=excluded.status, note=excluded.note`);
  const tx = db.transaction((items) => { for (const r of items) upsert.run(r.client_id, date, r.default_qty, r.delivered_qty, r.rate, r.amount, r.milk_type||null, r.status||'delivered', r.note||null); });
  tx(rows||[]);
  return { ok: true, count: (rows||[]).length };
});
ipcMain.handle("monthly:deleteDelivery", (_e, { id }) => { db.prepare("DELETE FROM customer_deliveries WHERE id=?").run(id); return { ok: true }; });

// Pauses
ipcMain.handle("monthly:pauses", (_e, { clientId }) => db.prepare("SELECT * FROM delivery_pauses WHERE client_id=? ORDER BY start_date DESC").all(clientId));
ipcMain.handle("monthly:addPause", (_e, { clientId, start_date, end_date, reason }) => { const i = db.prepare("INSERT INTO delivery_pauses (client_id,start_date,end_date,reason) VALUES (?,?,?,?)").run(clientId, start_date, end_date, reason||null); return db.prepare("SELECT * FROM delivery_pauses WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("monthly:deletePause", (_e, { id }) => { db.prepare("DELETE FROM delivery_pauses WHERE id=?").run(id); return { ok: true }; });

// Payments
ipcMain.handle("monthly:payments", (_e, { clientId }) => db.prepare("SELECT * FROM monthly_payments WHERE client_id=? ORDER BY entry_date DESC, id DESC").all(clientId));
ipcMain.handle("monthly:addPayment", (_e, { clientId, amount, period, note, entry_date }) => { const d = entry_date || new Date().toISOString().slice(0,10); const p = period || d.slice(0,7); const i = db.prepare("INSERT INTO monthly_payments (client_id,period,amount,note,entry_date) VALUES (?,?,?,?,?)").run(clientId, p, Number(amount), note||null, d); return db.prepare("SELECT * FROM monthly_payments WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("monthly:deletePayment", (_e, { id }) => { db.prepare("DELETE FROM monthly_payments WHERE id=?").run(id); return { ok: true }; });
ipcMain.handle("monthly:totals", (_e, { from, to }) => {
  const charges = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM customer_deliveries WHERE entry_date BETWEEN ? AND ?").get(from, to).v;
  const paid = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM monthly_payments WHERE entry_date BETWEEN ? AND ?").get(from, to).v;
  const out = db.prepare("SELECT (SELECT COALESCE(SUM(amount),0) FROM customer_deliveries) - (SELECT COALESCE(SUM(amount),0) FROM monthly_payments) v").get().v;
  return { charges, paid, outstanding: out };
});

// ---- Suppliers (legacy supported) ----
ipcMain.handle("purchases:suppliers", () => db.prepare(`SELECT s.*, COALESCE((SELECT SUM(CASE WHEN type='purchase' THEN amount ELSE -amount END) FROM purchases_v2 WHERE supplier_id=s.id),0) balance FROM suppliers s ORDER BY s.name`).all());
ipcMain.handle("purchases:supplier", (_e, { id }) => db.prepare("SELECT * FROM suppliers WHERE id=?").get(id));
ipcMain.handle("purchases:addSupplier", (_e, { name, mobile, address }) => { const i = db.prepare("INSERT INTO suppliers (name,mobile,address) VALUES (?,?,?)").run(name, mobile||null, address||null); return db.prepare("SELECT * FROM suppliers WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("purchases:deleteSupplier", (_e, { id }) => { db.prepare("DELETE FROM suppliers WHERE id=?").run(id); return { ok: true }; });
ipcMain.handle("purchases:supplierEntries", (_e, { supplierId }) => db.prepare("SELECT * FROM purchases_v2 WHERE supplier_id=? ORDER BY entry_date DESC, id DESC").all(supplierId));

// ---- Categories ----
ipcMain.handle("purchases:categories", () => db.prepare("SELECT * FROM purchase_categories ORDER BY kind, name").all());
ipcMain.handle("purchases:addCategory", (_e, { name, kind }) => { const i = db.prepare("INSERT INTO purchase_categories (name,kind,is_custom) VALUES (?,?,1)").run(name, kind||'item'); return db.prepare("SELECT * FROM purchase_categories WHERE id=?").get(i.lastInsertRowid); });
ipcMain.handle("purchases:deleteCategory", (_e, { id }) => { db.prepare("DELETE FROM purchase_categories WHERE id=? AND is_custom=1").run(id); return { ok: true }; });

// ---- Purchases (v2: all-purpose) ----
ipcMain.handle("purchases:entries", (_e, { from, to, categoryId, kind, q } = {}) => {
  let sql = `SELECT p.*, c.name AS category_name, c.kind AS category_kind, s.name AS supplier_name FROM purchases_v2 p LEFT JOIN purchase_categories c ON c.id=p.category_id LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE 1=1`;
  const args = [];
  if (from) { sql += " AND p.entry_date>=?"; args.push(from); }
  if (to)   { sql += " AND p.entry_date<=?"; args.push(to); }
  if (categoryId) { sql += " AND p.category_id=?"; args.push(categoryId); }
  if (kind) { sql += " AND c.kind=?"; args.push(kind); }
  if (q) { sql += " AND (p.item_name LIKE ? OR p.note LIKE ? OR s.name LIKE ?)"; const ql="%"+q+"%"; args.push(ql,ql,ql); }
  sql += " ORDER BY p.entry_date DESC, p.id DESC";
  return db.prepare(sql).all(...args);
});
ipcMain.handle("purchases:addEntry", (_e, p) => {
  const date = p.entry_date || new Date().toISOString().slice(0,10);
  const amount = Number(p.amount) || ((Number(p.qty)||0) * (Number(p.rate)||0));
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO purchases_v2 (entry_date,category_id,supplier_id,item_name,qty,unit,rate,amount,paid_now,type,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(date, p.categoryId||null, p.supplierId||null, p.itemName||null, p.qty!=null?Number(p.qty):null, p.unit||null, p.rate!=null?Number(p.rate):null, amount, Number(p.paidNow)||0, p.type||'purchase', p.note||null);
    if ((p.type||'purchase')==='purchase' && Number(p.paidNow)>0 && p.supplierId) {
      db.prepare("INSERT INTO purchases_v2 (entry_date,supplier_id,amount,type,note) VALUES (?,?,?,?,?)").run(date, p.supplierId, Number(p.paidNow), 'payment', 'Paid with purchase');
    }
  });
  tx();
  return { ok: true };
});
ipcMain.handle("purchases:deleteEntry", (_e, { id }) => { db.prepare("DELETE FROM purchases_v2 WHERE id=?").run(id); return { ok: true }; });
ipcMain.handle("purchases:totals", (_e, args = {}) => {
  const today = new Date().toISOString().slice(0,10);
  const month = today.slice(0,7);
  const from = args.from, to = args.to;
  const q = (cond, params) => db.prepare("SELECT COALESCE(SUM(p.amount),0) v FROM purchases_v2 p LEFT JOIN purchase_categories c ON c.id=p.category_id WHERE p.type='purchase' "+cond).get(...params).v;
  const itemsCond = " AND (c.kind='item' OR c.kind IS NULL)";
  const expCond = " AND c.kind='expense'";
  return {
    today: q("AND p.entry_date=?"+itemsCond, [today]),
    month: q("AND p.entry_date LIKE ?"+itemsCond, [month+"%"]),
    all: q(itemsCond, []),
    range_items: from&&to ? q("AND p.entry_date BETWEEN ? AND ?"+itemsCond, [from,to]) : 0,
    range_expenses: from&&to ? q("AND p.entry_date BETWEEN ? AND ?"+expCond, [from,to]) : 0,
  };
});
ipcMain.handle("purchases:expensesByCategory", (_e, { from, to }) => db.prepare(`SELECT c.name, COALESCE(SUM(p.amount),0) total FROM purchase_categories c LEFT JOIN purchases_v2 p ON p.category_id=c.id AND p.type='purchase' AND p.entry_date BETWEEN ? AND ? WHERE c.kind='expense' GROUP BY c.id ORDER BY c.name`).all(from, to));

// ---- Backup ----
ipcMain.handle("data:backup", async () => { const { canceled, filePath } = await dialog.showSaveDialog({ title: "Backup", defaultPath: `milkshop-${new Date().toISOString().slice(0,10)}.db`, filters: [{ name: "SQLite", extensions: ["db"] }] }); if (canceled||!filePath) return { ok:false }; fs.copyFileSync(dbPath, filePath); return { ok:true, path:filePath }; });
ipcMain.handle("data:restore", async () => { const { canceled, filePaths } = await dialog.showOpenDialog({ title: "Restore", properties: ["openFile"], filters: [{ name: "SQLite", extensions: ["db"] }] }); if (canceled||!filePaths?.[0]) return { ok:false }; fs.copyFileSync(filePaths[0], dbPath); app.relaunch(); app.exit(0); return { ok:true }; });
ipcMain.handle("data:clearAll", (_e, { currentPassword }) => {
  if (!session) return { ok:false, error:"Not logged in" };
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(session.id);
  if (!u || !bcrypt.compareSync(currentPassword, u.password_hash)) return { ok:false, error:"Wrong password" };
  db.exec(`DELETE FROM cash_transactions; DELETE FROM udhar_transactions; DELETE FROM udhar_customers; DELETE FROM monthly_payments; DELETE FROM customer_deliveries; DELETE FROM delivery_pauses; DELETE FROM monthly_clients; DELETE FROM purchases_v2; DELETE FROM purchase_entries; DELETE FROM suppliers;`);
  setSetting("invoice_counter", "1000");
  return { ok:true };
});

// ---- Printing ----
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function buildReceiptHtml({ invoice_no, amount, date, logo_data_url, width_mm }) {
  const widthCss = `${width_mm || 80}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:${widthCss} auto;margin:0}
    html,body{margin:0;padding:0}
    body{width:${widthCss};font-family:'Courier New',monospace;color:#000;padding:4mm 3mm;text-align:center}
    .logo{max-height:14mm;max-width:60%;object-fit:contain;display:block;margin:0 auto 2mm}
    .inv{text-align:left;font-size:10pt;font-weight:700;margin-bottom:3mm}
    .amt-box{border:2px solid #000;border-radius:2mm;padding:4mm 2mm;margin:2mm 0}
    .amt{font-size:26pt;font-weight:900;letter-spacing:1px;line-height:1}
    .foot{margin-top:5mm;font-size:8pt;font-style:italic;border-top:1px dashed #000;padding-top:2mm}
  </style></head><body>
    ${logo_data_url?`<img class="logo" src="${logo_data_url}"/>`:''}
    <div class="inv">Invoice #${invoice_no}<br/><span style="font-weight:400">${date}</span></div>
    <div class="amt-box"><div class="amt">Rs. ${Number(amount).toLocaleString()}</div></div>
    <div class="foot">Designed &amp; developed by Zubair Khan</div>
  </body></html>`;
}
async function silentPrint(html, opts={}) {
  const printerName = getSetting("printer_name") || "";
  const win = new BrowserWindow({ show: false });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return new Promise((resolve) => {
    win.webContents.print({ silent: true, deviceName: printerName || undefined, margins: { marginType: "none" }, ...opts }, (success, failureReason) => {
      win.close(); resolve({ ok: success, error: success ? null : failureReason });
    });
  });
}
ipcMain.handle("print:receipt", async (_e, payload) => {
  const width = getSetting("receipt_width") || "80";
  const html = buildReceiptHtml({ ...payload, width_mm: width });
  return silentPrint(html, { pageSize: { width: (parseInt(width,10)||80)*1000, height: 200000 } });
});
ipcMain.handle("print:testReceipt", async () => {
  const s = getAllSettings();
  const html = buildReceiptHtml({ invoice_no: "TEST", amount: 0, date: new Date().toLocaleDateString(), shop_name: s.shop_name, logo_data_url: s.logo_data_url, width_mm: s.receipt_width });
  return silentPrint(html);
});
ipcMain.handle("print:html", async (_e, { html, thermal }) => {
  if (thermal) {
    const w = getSetting("receipt_width") || "80";
    return silentPrint(html, { pageSize: { width: (parseInt(w,10)||80)*1000, height: 800000 } });
  }
  return silentPrint(html);
});

// ---- First-install wizard ----
ipcMain.handle("setup:status", () => {
  const r = db.prepare("SELECT value FROM settings WHERE key='first_install_complete'").get();
  return { complete: r?.value === "1" };
});
ipcMain.handle("setup:complete", (_e, p = {}) => {
  const username = (p.username || "admin").trim();
  const password = p.password || "";
  if (!username || password.length < 4) return { ok: false, error: "Username required and password must be at least 4 characters" };
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM users LIMIT 1").get();
    const hash = bcrypt.hashSync(password, 10);
    if (existing) db.prepare("UPDATE users SET username=?, password_hash=?, is_admin=1 WHERE id=?").run(username, hash, existing.id);
    else db.prepare("INSERT INTO users (username,password_hash,is_admin) VALUES (?,?,1)").run(username, hash);
    if (p.shop_name != null) setSetting("shop_name", p.shop_name);
    if (p.logo_data_url != null) setSetting("logo_data_url", p.logo_data_url);
    if (p.printer_name != null) setSetting("printer_name", p.printer_name);
    setSetting("first_install_complete", "1");
  });
  tx();
  return { ok: true };
});

// ---- Supplier Ledger (Phase 1 — UUID + audit) ----
function supplierOutstanding(id) {
  const open = db.prepare("SELECT COALESCE(opening_balance,0) v FROM suppliers_v2 WHERE id=? AND deleted_at IS NULL").get(id)?.v || 0;
  const purch = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM purchases_v3 WHERE supplier_id=? AND payment_mode='credit' AND deleted_at IS NULL").get(id).v;
  const paid = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE supplier_id=? AND deleted_at IS NULL").get(id).v;
  return open + purch - paid;
}
ipcMain.handle("sl:suppliers", (_e, { q } = {}) => {
  const rows = db.prepare("SELECT * FROM suppliers_v2 WHERE deleted_at IS NULL ORDER BY name").all();
  const ql = (q || "").toLowerCase();
  return rows
    .filter(r => !ql || (r.name + " " + (r.mobile||"") + " " + (r.address||"")).toLowerCase().includes(ql))
    .map(r => ({ ...r, outstanding: supplierOutstanding(r.id) }));
});
ipcMain.handle("sl:supplier", (_e, { id }) => {
  const r = db.prepare("SELECT * FROM suppliers_v2 WHERE id=? AND deleted_at IS NULL").get(id);
  return r ? { ...r, outstanding: supplierOutstanding(id) } : null;
});
ipcMain.handle("sl:addSupplier", (_e, p) => {
  const id = uuid();
  const by = session?.username || null;
  db.prepare("INSERT INTO suppliers_v2 (id,name,mobile,address,opening_balance,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, p.name, p.mobile||null, p.address||null, Number(p.opening_balance)||0, p.notes||null, by, by);
  return db.prepare("SELECT * FROM suppliers_v2 WHERE id=?").get(id);
});
ipcMain.handle("sl:updateSupplier", (_e, p) => {
  const by = session?.username || null;
  db.prepare("UPDATE suppliers_v2 SET name=?,mobile=?,address=?,opening_balance=?,notes=?,updated_at=datetime('now'),updated_by=? WHERE id=?")
    .run(p.name, p.mobile||null, p.address||null, Number(p.opening_balance)||0, p.notes||null, by, p.id);
  return { ok: true };
});
ipcMain.handle("sl:deleteSupplier", (_e, { id }) => {
  const by = session?.username || null;
  db.prepare("UPDATE suppliers_v2 SET deleted_at=datetime('now'), updated_at=datetime('now'), updated_by=? WHERE id=?").run(by, id);
  return { ok: true };
});
ipcMain.handle("sl:ledger", (_e, { supplierId, from, to, q } = {}) => {
  const fromD = from || "0000-01-01", toD = to || "9999-12-31";
  const ql = (q || "").toLowerCase();
  const purchases = db.prepare("SELECT id,entry_date,invoice_no,item_name,qty,unit,rate,amount,payment_mode,notes FROM purchases_v3 WHERE supplier_id=? AND entry_date BETWEEN ? AND ? AND deleted_at IS NULL").all(supplierId, fromD, toD)
    .map(r => ({ ...r, kind: "purchase" }));
  const payments = db.prepare("SELECT id,entry_date,amount,mode,reference_no,notes FROM supplier_payments WHERE supplier_id=? AND entry_date BETWEEN ? AND ? AND deleted_at IS NULL").all(supplierId, fromD, toD)
    .map(r => ({ ...r, kind: "payment" }));
  let entries = [...purchases, ...payments];
  if (ql) entries = entries.filter(e => `${e.item_name||""} ${e.invoice_no||""} ${e.reference_no||""} ${e.notes||""} ${e.mode||""}`.toLowerCase().includes(ql));
  entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || String(a.id).localeCompare(String(b.id)));
  // Compute running balance, starting from opening_balance + activity before fromD
  const sup = db.prepare("SELECT opening_balance FROM suppliers_v2 WHERE id=?").get(supplierId);
  const priorP = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM purchases_v3 WHERE supplier_id=? AND payment_mode='credit' AND entry_date<? AND deleted_at IS NULL").get(supplierId, fromD).v;
  const priorPay = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE supplier_id=? AND entry_date<? AND deleted_at IS NULL").get(supplierId, fromD).v;
  let bal = (sup?.opening_balance || 0) + priorP - priorPay;
  const opening = bal;
  const rows = entries.map(e => {
    if (e.kind === "purchase") {
      const debit = e.payment_mode === "credit" ? e.amount : 0;
      bal += debit;
      return { ...e, debit, credit: 0, balance: bal };
    } else {
      bal -= e.amount;
      return { ...e, debit: 0, credit: e.amount, balance: bal };
    }
  });
  return { opening, rows, closing: bal };
});
ipcMain.handle("sl:addPurchase", (_e, p) => {
  const id = uuid();
  const by = session?.username || null;
  const amount = p.amount != null ? Number(p.amount) : (Number(p.qty)||0) * (Number(p.rate)||0);
  db.prepare("INSERT INTO purchases_v3 (id,supplier_id,entry_date,invoice_no,item_name,qty,unit,rate,amount,payment_mode,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, p.supplier_id||null, p.entry_date || new Date().toISOString().slice(0,10), p.invoice_no||null, p.item_name||null, p.qty!=null?Number(p.qty):null, p.unit||null, p.rate!=null?Number(p.rate):null, amount, p.payment_mode || "credit", p.notes||null, by, by);
  return { ok: true, id };
});
ipcMain.handle("sl:addPayment", (_e, p) => {
  const id = uuid();
  const by = session?.username || null;
  db.prepare("INSERT INTO supplier_payments (id,supplier_id,entry_date,amount,mode,reference_no,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, p.supplier_id, p.entry_date || new Date().toISOString().slice(0,10), Number(p.amount), p.mode || "cash", p.reference_no||null, p.notes||null, by, by);
  return { ok: true, id };
});
ipcMain.handle("sl:deletePurchase", (_e, { id }) => {
  const by = session?.username || null;
  db.prepare("UPDATE purchases_v3 SET deleted_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").run(by, id);
  return { ok: true };
});
ipcMain.handle("sl:deletePayment", (_e, { id }) => {
  const by = session?.username || null;
  db.prepare("UPDATE supplier_payments SET deleted_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").run(by, id);
  return { ok: true };
});
ipcMain.handle("sl:totals", (_e, { from, to } = {}) => {
  const fromD = from || "0000-01-01", toD = to || "9999-12-31";
  const purchases = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM purchases_v3 WHERE entry_date BETWEEN ? AND ? AND deleted_at IS NULL").get(fromD,toD).v;
  const payments = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE entry_date BETWEEN ? AND ? AND deleted_at IS NULL").get(fromD,toD).v;
  const sups = db.prepare("SELECT id FROM suppliers_v2 WHERE deleted_at IS NULL").all();
  const outstanding = sups.reduce((a, s) => a + supplierOutstanding(s.id), 0);
  return { purchases, payments, outstanding };
});

// ---- Window ----
function showLoadError(win, code, desc, url) {
  const msg = `Renderer failed to load.\nCode: ${code}\nReason: ${desc}\nURL: ${url}`;
  console.error(msg);
  const html = `<!doctype html><html><body style="font:14px system-ui;padding:24px;color:#111">
    <h2 style="color:#b91c1c;margin:0 0 12px">Renderer failed to load</h2>
    <pre style="background:#f3f4f6;padding:12px;border-radius:6px;white-space:pre-wrap">${msg.replace(/[&<>]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c]))}</pre>
    <p>The packaged <code>dist/index.html</code> was not found or failed to load. Reinstall the application; if the problem persists this is a packaging regression.</p>
  </body></html>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    // -3 = user/HMR aborted, ignore
    if (code === -3) return;
    showLoadError(win, code, desc, url);
  });

  const devUrl = process.env.ELECTRON_DEV_URL;
  if (!app.isPackaged && devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "dist-electron", "index.html");
    if (!fs.existsSync(indexPath)) {
      showLoadError(win, "ENOENT", "dist-electron/index.html missing (run `npm run build:electron` before packaging)", indexPath);
    } else {
      win.loadFile(indexPath);
    }
  }
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

