// Electron main process — Milk Shop Manager
// Offline desktop app: SQLite storage, bcrypt auth, silent thermal printing.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

let Database, bcrypt;
try { Database = require("better-sqlite3"); } catch (e) { console.error("better-sqlite3 missing — run: npm install better-sqlite3"); throw e; }
try { bcrypt = require("bcryptjs"); } catch (e) { console.error("bcryptjs missing — run: npm install bcryptjs"); throw e; }

// ---- DB ----
const userDataDir = app.getPath("userData");
if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
const dbPath = path.join(userDataDir, "milkshop.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS cash_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no INTEGER NOT NULL UNIQUE,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS udhar_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS udhar_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES udhar_customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('credit','payment')),
  amount REAL NOT NULL,
  note TEXT,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS monthly_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT,
  daily_qty REAL NOT NULL DEFAULT 0,
  milk_type TEXT NOT NULL DEFAULT 'cow',
  rate REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS monthly_client_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES monthly_clients(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  qty REAL NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchase_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('purchase','payment')),
  amount REAL NOT NULL,
  qty REAL,
  rate REAL,
  note TEXT,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed admin user + defaults
const userCount = db.prepare("SELECT COUNT(*) c FROM users").get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)").run("admin", hash);
}
const defaults = {
  shop_name: "Milk Shop",
  logo_data_url: "",
  language: "en",
  printer_name: "",
  receipt_width: "80", // mm
  invoice_counter: "1000",
};
const setStmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(defaults)) setStmt.run(k, v);

// ---- session (in-memory) ----
let session = null; // { id, username }

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, String(value ?? ""));
}
function getAllSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ---- IPC ----
ipcMain.handle("auth:login", (_e, { username, password }) => {
  const u = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!u) return { ok: false, error: "Invalid credentials" };
  if (!bcrypt.compareSync(password, u.password_hash)) return { ok: false, error: "Invalid credentials" };
  session = { id: u.id, username: u.username };
  return { ok: true, user: session };
});
ipcMain.handle("auth:session", () => session);
ipcMain.handle("auth:logout", () => { session = null; return { ok: true }; });
ipcMain.handle("auth:change", (_e, { currentPassword, newUsername, newPassword }) => {
  if (!session) return { ok: false, error: "Not logged in" };
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(session.id);
  if (!u || !bcrypt.compareSync(currentPassword, u.password_hash)) return { ok: false, error: "Current password is wrong" };
  const username = (newUsername || u.username).trim();
  const password_hash = newPassword ? bcrypt.hashSync(newPassword, 10) : u.password_hash;
  try {
    db.prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?").run(username, password_hash, u.id);
  } catch (e) { return { ok: false, error: e.message }; }
  session = { id: u.id, username };
  return { ok: true, user: session };
});

ipcMain.handle("settings:getAll", () => getAllSettings());
ipcMain.handle("settings:set", (_e, { key, value }) => { setSetting(key, value); return { ok: true }; });
ipcMain.handle("settings:getPrinters", async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    const list = await win.webContents.getPrintersAsync();
    return list.map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault, status: p.status }));
  } catch { return []; }
});

ipcMain.handle("cash:add", (_e, { amount }) => {
  const counter = parseInt(getSetting("invoice_counter") || "1000", 10) + 1;
  const info = db.prepare("INSERT INTO cash_transactions (invoice_no, amount) VALUES (?, ?)").run(counter, Number(amount));
  setSetting("invoice_counter", String(counter));
  const row = db.prepare("SELECT * FROM cash_transactions WHERE id = ?").get(info.lastInsertRowid);
  return row;
});
ipcMain.handle("cash:recent", (_e, { limit = 20 } = {}) => db.prepare("SELECT * FROM cash_transactions ORDER BY id DESC LIMIT ?").all(limit));
ipcMain.handle("cash:todayTotal", () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = db.prepare("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM cash_transactions WHERE date(created_at) = ?").get(today);
  return r;
});
ipcMain.handle("cash:range", (_e, { from, to }) => db.prepare("SELECT date(created_at) day, COALESCE(SUM(amount),0) total FROM cash_transactions WHERE date(created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day").all(from, to));

ipcMain.handle("udhar:customers", () => db.prepare(`
  SELECT c.*,
    COALESCE((SELECT SUM(CASE WHEN type='credit' THEN amount ELSE -amount END) FROM udhar_transactions WHERE customer_id = c.id), 0) balance
  FROM udhar_customers c ORDER BY c.name`).all());
ipcMain.handle("udhar:customer", (_e, { id }) => db.prepare("SELECT * FROM udhar_customers WHERE id = ?").get(id));
ipcMain.handle("udhar:addCustomer", (_e, { name, mobile, address }) => {
  const info = db.prepare("INSERT INTO udhar_customers (name, mobile, address) VALUES (?,?,?)").run(name, mobile || null, address || null);
  return db.prepare("SELECT * FROM udhar_customers WHERE id = ?").get(info.lastInsertRowid);
});
ipcMain.handle("udhar:deleteCustomer", (_e, { id }) => { db.prepare("DELETE FROM udhar_customers WHERE id = ?").run(id); return { ok: true }; });
ipcMain.handle("udhar:entries", (_e, { customerId }) => db.prepare("SELECT * FROM udhar_transactions WHERE customer_id = ? ORDER BY entry_date DESC, id DESC").all(customerId));
ipcMain.handle("udhar:addEntry", (_e, { customerId, type, amount, note, entry_date }) => {
  const info = db.prepare("INSERT INTO udhar_transactions (customer_id, type, amount, note, entry_date) VALUES (?,?,?,?,?)")
    .run(customerId, type, Number(amount), note || null, entry_date || new Date().toISOString().slice(0,10));
  return db.prepare("SELECT * FROM udhar_transactions WHERE id = ?").get(info.lastInsertRowid);
});

ipcMain.handle("monthly:list", () => db.prepare("SELECT * FROM monthly_clients ORDER BY name").all());
ipcMain.handle("monthly:add", (_e, c) => {
  const info = db.prepare("INSERT INTO monthly_clients (name, mobile, daily_qty, milk_type, rate, active) VALUES (?,?,?,?,?,1)")
    .run(c.name, c.mobile || null, Number(c.daily_qty || 0), c.milk_type || 'cow', Number(c.rate || 0));
  return db.prepare("SELECT * FROM monthly_clients WHERE id = ?").get(info.lastInsertRowid);
});
ipcMain.handle("monthly:update", (_e, { id, ...c }) => {
  db.prepare("UPDATE monthly_clients SET name=?, mobile=?, daily_qty=?, milk_type=?, rate=?, active=? WHERE id=?")
    .run(c.name, c.mobile || null, Number(c.daily_qty || 0), c.milk_type, Number(c.rate || 0), c.active ? 1 : 0, id);
  return { ok: true };
});
ipcMain.handle("monthly:delete", (_e, { id }) => { db.prepare("DELETE FROM monthly_clients WHERE id = ?").run(id); return { ok: true }; });

// ---- Purchases / Suppliers ----
ipcMain.handle("purchases:suppliers", () => db.prepare(`
  SELECT s.*,
    COALESCE((SELECT SUM(CASE WHEN type='purchase' THEN amount ELSE -amount END) FROM purchase_entries WHERE supplier_id = s.id), 0) balance
  FROM suppliers s ORDER BY s.name`).all());
ipcMain.handle("purchases:supplier", (_e, { id }) => db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id));
ipcMain.handle("purchases:addSupplier", (_e, { name, mobile, address }) => {
  const info = db.prepare("INSERT INTO suppliers (name, mobile, address) VALUES (?,?,?)").run(name, mobile || null, address || null);
  return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(info.lastInsertRowid);
});
ipcMain.handle("purchases:deleteSupplier", (_e, { id }) => { db.prepare("DELETE FROM suppliers WHERE id = ?").run(id); return { ok: true }; });
ipcMain.handle("purchases:entries", (_e, { supplierId }) => db.prepare("SELECT * FROM purchase_entries WHERE supplier_id = ? ORDER BY entry_date DESC, id DESC").all(supplierId));
ipcMain.handle("purchases:addEntry", (_e, { supplierId, type, amount, qty, rate, paid_now, note, entry_date }) => {
  const date = entry_date || new Date().toISOString().slice(0, 10);
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO purchase_entries (supplier_id, type, amount, qty, rate, note, entry_date) VALUES (?,?,?,?,?,?,?)")
      .run(supplierId, type, Number(amount), qty != null ? Number(qty) : null, rate != null ? Number(rate) : null, note || null, date);
    if (type === "purchase" && Number(paid_now) > 0) {
      db.prepare("INSERT INTO purchase_entries (supplier_id, type, amount, note, entry_date) VALUES (?,?,?,?,?)")
        .run(supplierId, "payment", Number(paid_now), "Paid with purchase", date);
    }
  });
  tx();
  return { ok: true };
});
ipcMain.handle("purchases:totals", () => {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7) + "%";
  const t = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM purchase_entries WHERE type='purchase' AND entry_date = ?").get(today).v;
  const m = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM purchase_entries WHERE type='purchase' AND entry_date LIKE ?").get(month).v;
  const a = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM purchase_entries WHERE type='purchase'").get().v;
  return { today: t, month: m, all: a };
});

// ---- Backup / Restore / Clear ----
ipcMain.handle("data:backup", async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Backup database",
    defaultPath: `milkshop-backup-${new Date().toISOString().slice(0,10)}.db`,
    filters: [{ name: "SQLite", extensions: ["db"] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.copyFileSync(dbPath, filePath);
  return { ok: true, path: filePath };
});
ipcMain.handle("data:restore", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Restore database",
    properties: ["openFile"],
    filters: [{ name: "SQLite", extensions: ["db"] }],
  });
  if (canceled || !filePaths?.[0]) return { ok: false };
  fs.copyFileSync(filePaths[0], dbPath);
  app.relaunch(); app.exit(0);
  return { ok: true };
});
ipcMain.handle("data:clearAll", (_e, { currentPassword }) => {
  if (!session) return { ok: false, error: "Not logged in" };
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(session.id);
  if (!u || !bcrypt.compareSync(currentPassword, u.password_hash)) return { ok: false, error: "Wrong password" };
  db.exec(`
    DELETE FROM cash_transactions;
    DELETE FROM udhar_transactions;
    DELETE FROM udhar_customers;
    DELETE FROM monthly_client_transactions;
    DELETE FROM monthly_clients;
    DELETE FROM purchase_entries;
    DELETE FROM suppliers;
  `);
  setSetting("invoice_counter", "1000");
  return { ok: true };
});

// ---- Silent printing ----
function buildReceiptHtml({ invoice_no, amount, date, shop_name, logo_data_url, width_mm }) {
  const widthCss = `${width_mm || 80}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${widthCss} auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { width: ${widthCss}; font-family: 'Courier New', monospace; color: #000; text-align: center; padding: 4mm 2mm; }
    .logo { max-width: 90%; max-height: 18mm; object-fit: contain; margin: 0 auto 2mm; display: block; }
    .shop { font-size: 12pt; font-weight: 700; margin-bottom: 2mm; }
    .line { border-top: 1px dashed #000; margin: 2mm 0; }
    .row { display: flex; justify-content: space-between; font-size: 10pt; padding: 0 1mm; }
    .amt { font-size: 22pt; font-weight: 800; margin: 3mm 0; letter-spacing: 1px; }
  </style></head><body>
    ${logo_data_url ? `<img class="logo" src="${logo_data_url}" />` : ''}
    <div class="shop">${escapeHtml(shop_name || 'MILK SHOP')}</div>
    <div class="line"></div>
    <div class="row"><span>Invoice</span><span>#${invoice_no}</span></div>
    <div class="row"><span>Date</span><span>${date}</span></div>
    <div class="line"></div>
    <div class="amt">Rs. ${Number(amount).toLocaleString()}</div>
    <div class="line"></div>
  </body></html>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

ipcMain.handle("print:receipt", async (_e, payload) => {
  const printerName = getSetting("printer_name") || "";
  const width = getSetting("receipt_width") || "80";
  const html = buildReceiptHtml({ ...payload, width_mm: width });
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return new Promise((resolve) => {
    win.webContents.print({
      silent: true,
      deviceName: printerName || undefined,
      margins: { marginType: "none" },
      pageSize: { width: (parseInt(width, 10) || 80) * 1000, height: 200000 }, // micrometers
    }, (success, failureReason) => {
      win.close();
      resolve({ ok: success, error: success ? null : failureReason });
    });
  });
});

ipcMain.handle("print:test", async () => {
  return await ipcMain._invokeHandler ? null : null; // placeholder; handled below
});
// Test print uses same channel
ipcMain.handle("print:testReceipt", async () => {
  const s = getAllSettings();
  const html = buildReceiptHtml({
    invoice_no: "TEST", amount: 0, date: new Date().toLocaleDateString(),
    shop_name: s.shop_name, logo_data_url: s.logo_data_url, width_mm: s.receipt_width,
  });
  const win = new BrowserWindow({ show: false });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return new Promise((resolve) => {
    win.webContents.print({ silent: true, deviceName: s.printer_name || undefined, margins: { marginType: "none" } },
      (success, failureReason) => { win.close(); resolve({ ok: success, error: failureReason }); });
  });
});

// ---- Window ----
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.ELECTRON_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
