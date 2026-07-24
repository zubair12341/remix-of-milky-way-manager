// Typed bridge to Electron main process (window.api) with localStorage fallback for preview.

export type User = { id: number; username: string };
export type CashTxn = { id: number; invoice_no: number; amount: number; created_at: string };
export type UdharCustomer = { id: number; name: string; mobile: string | null; address: string | null; created_at: string; balance: number };
export type UdharEntry = { id: number; customer_id: number; type: "credit" | "payment"; amount: number; note: string | null; entry_date: string; created_at: string };
export type MonthlyClient = {
  id: number; name: string; mobile: string | null; address: string | null;
  daily_qty: number; milk_type: string; rate: number; active: number; created_at: string;
  month_amount?: number; month_qty?: number; paid_this_month?: number; paid_total?: number;
  total_charges?: number; balance?: number; paused?: number; pause_end?: string | null;
  charges?: number; paid?: number;
};
export type MonthlyPayment = { id: number; client_id: number; period: string; amount: number; note: string | null; entry_date: string; created_at: string };
export type CustomerDelivery = { id: number; client_id: number; entry_date: string; default_qty: number; delivered_qty: number; rate: number; amount: number; milk_type: string | null; status: "delivered" | "skipped"; note: string | null; created_at: string };
export type DeliveryPause = { id: number; client_id: number; start_date: string; end_date: string; reason: string | null; created_at: string };
export type SettingsMap = Record<string, string>;
export type PrinterInfo = { name: string; displayName: string; isDefault: boolean; status: number };
export type Supplier = { id: number; name: string; mobile: string | null; address: string | null; created_at: string; balance: number };
export type PurchaseCategory = { id: number; name: string; kind: "item" | "expense"; is_custom: number };
export type PurchaseEntry = {
  id: number; entry_date: string; category_id: number | null; supplier_id: number | null;
  item_name: string | null; qty: number | null; unit: string | null; rate: number | null;
  amount: number; paid_now: number; type: "purchase" | "payment"; note: string | null;
  category_name?: string | null; category_kind?: "item" | "expense" | null; supplier_name?: string | null;
};
export type PurchaseTotals = { today: number; month: number; all: number; range_items: number; range_expenses: number };

export type SupplierV2 = { id: string; name: string; mobile: string | null; address: string | null; opening_balance: number; notes: string | null; deleted_at: string | null; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null; outstanding?: number };
export type SupplierLedgerRow = { id: string; entry_date: string; kind: "purchase" | "payment"; debit: number; credit: number; balance: number; invoice_no?: string | null; item_name?: string | null; qty?: number | null; unit?: string | null; rate?: number | null; amount?: number; payment_mode?: "cash" | "credit"; mode?: string; reference_no?: string | null; notes?: string | null };
export type SupplierLedger = { opening: number; rows: SupplierLedgerRow[]; closing: number };

declare global {
  interface Window {
    api?: {
      isElectron: boolean;
      auth: {
        login: (u: string, p: string) => Promise<{ ok: boolean; user?: User; error?: string }>;
        session: () => Promise<User | null>;
        logout: () => Promise<{ ok: boolean }>;
        change: (cur: string, nu: string, np: string) => Promise<{ ok: boolean; user?: User; error?: string }>;
      };
      setup: {
        status: () => Promise<{ complete: boolean }>;
        complete: (p: { username: string; password: string; shop_name?: string; logo_data_url?: string; printer_name?: string }) => Promise<{ ok: boolean; error?: string }>;
      };
      settings: {
        getAll: () => Promise<SettingsMap>;
        set: (k: string, v: string) => Promise<{ ok: boolean }>;
        getPrinters: () => Promise<PrinterInfo[]>;
      };
      cash: {
        add: (amount: number) => Promise<CashTxn>;
        recent: (limit?: number) => Promise<CashTxn[]>;
        todayTotal: () => Promise<{ total: number; count: number }>;
        range: (from: string, to: string) => Promise<{ day: string; total: number }[]>;
        sum: (from: string, to: string) => Promise<{ total: number; count: number }>;
      };
      udhar: {
        customers: () => Promise<UdharCustomer[]>;
        customer: (id: number) => Promise<UdharCustomer | null>;
        addCustomer: (i: { name: string; mobile?: string; address?: string }) => Promise<UdharCustomer>;
        deleteCustomer: (id: number) => Promise<{ ok: boolean }>;
        entries: (customerId: number) => Promise<UdharEntry[]>;
        addEntry: (i: { customerId: number; type: "credit" | "payment"; amount: number; note?: string; entry_date?: string }) => Promise<UdharEntry>;
        totals: (from: string, to: string) => Promise<{ credit: number; payment: number; outstanding: number }>;
      };
      monthly: {
        list: () => Promise<MonthlyClient[]>;
        client: (id: number) => Promise<MonthlyClient | null>;
        add: (i: Partial<MonthlyClient>) => Promise<MonthlyClient>;
        update: (i: Partial<MonthlyClient> & { id: number }) => Promise<{ ok: boolean }>;
        delete: (id: number) => Promise<{ ok: boolean }>;
        deliveries: (from?: string, to?: string, clientId?: number) => Promise<CustomerDelivery[]>;
        deliveriesForDate: (date: string) => Promise<CustomerDelivery[]>;
        saveDeliveries: (date: string, rows: Array<{ client_id: number; default_qty: number; delivered_qty: number; rate: number; amount: number; milk_type?: string; status?: "delivered" | "skipped"; note?: string }>) => Promise<{ ok: boolean; count: number }>;
        deleteDelivery: (id: number) => Promise<{ ok: boolean }>;
        pauses: (clientId: number) => Promise<DeliveryPause[]>;
        addPause: (i: { clientId: number; start_date: string; end_date: string; reason?: string }) => Promise<DeliveryPause>;
        deletePause: (id: number) => Promise<{ ok: boolean }>;
        payments: (clientId: number) => Promise<MonthlyPayment[]>;
        addPayment: (i: { clientId: number; amount: number; period?: string; note?: string; entry_date?: string }) => Promise<MonthlyPayment>;
        deletePayment: (id: number) => Promise<{ ok: boolean }>;
        totals: (from: string, to: string) => Promise<{ charges: number; paid: number; outstanding: number }>;
      };
      purchases: {
        suppliers: () => Promise<Supplier[]>;
        supplier: (id: number) => Promise<Supplier | null>;
        addSupplier: (i: { name: string; mobile?: string; address?: string }) => Promise<Supplier>;
        deleteSupplier: (id: number) => Promise<{ ok: boolean }>;
        supplierEntries: (supplierId: number) => Promise<PurchaseEntry[]>;
        categories: () => Promise<PurchaseCategory[]>;
        addCategory: (i: { name: string; kind: "item" | "expense" }) => Promise<PurchaseCategory>;
        deleteCategory: (id: number) => Promise<{ ok: boolean }>;
        entries: (filters?: { from?: string; to?: string; categoryId?: number; kind?: "item" | "expense"; q?: string }) => Promise<PurchaseEntry[]>;
        addEntry: (i: { entry_date?: string; categoryId?: number | null; supplierId?: number | null; itemName?: string; qty?: number; unit?: string; rate?: number; amount?: number; paidNow?: number; type?: "purchase" | "payment"; note?: string }) => Promise<{ ok: boolean }>;
        deleteEntry: (id: number) => Promise<{ ok: boolean }>;
        totals: (args?: { from?: string; to?: string }) => Promise<PurchaseTotals>;
        expensesByCategory: (from: string, to: string) => Promise<{ name: string; total: number }[]>;
      };
      supplierLedger: {
        suppliers: (q?: string) => Promise<SupplierV2[]>;
        supplier: (id: string) => Promise<SupplierV2 | null>;
        addSupplier: (i: { name: string; mobile?: string; address?: string; opening_balance?: number; notes?: string }) => Promise<SupplierV2>;
        updateSupplier: (i: { id: string; name: string; mobile?: string; address?: string; opening_balance?: number; notes?: string }) => Promise<{ ok: boolean }>;
        deleteSupplier: (id: string) => Promise<{ ok: boolean }>;
        ledger: (a: { supplierId: string; from?: string; to?: string; q?: string }) => Promise<SupplierLedger>;
        addPurchase: (i: { supplier_id: string; entry_date?: string; invoice_no?: string; item_name?: string; qty?: number; unit?: string; rate?: number; amount?: number; payment_mode?: "cash" | "credit"; notes?: string }) => Promise<{ ok: boolean; id: string }>;
        addPayment: (i: { supplier_id: string; entry_date?: string; amount: number; mode?: "cash" | "bank" | "upi" | "cheque" | "other"; reference_no?: string; notes?: string }) => Promise<{ ok: boolean; id: string }>;
        deletePurchase: (id: string) => Promise<{ ok: boolean }>;
        deletePayment: (id: string) => Promise<{ ok: boolean }>;
        totals: (args?: { from?: string; to?: string }) => Promise<{ purchases: number; payments: number; outstanding: number }>;
      };
      print: {
        receipt: (p: { invoice_no: number | string; amount: number; date: string; shop_name: string; logo_data_url?: string }) => Promise<{ ok: boolean; error?: string | null }>;
        test: () => Promise<{ ok: boolean; error?: string | null }>;
        html: (html: string, thermal?: boolean) => Promise<{ ok: boolean; error?: string | null }>;
      };
      data: {
        backup: () => Promise<{ ok: boolean; path?: string }>;
        restore: () => Promise<{ ok: boolean }>;
        clearAll: (currentPassword: string) => Promise<{ ok: boolean; error?: string }>;
      };
    };
  }
}


// ---- Web stub (Lovable preview) ----
const LS_KEY = "milkshop_stub_v2";
type Store = {
  users: { id: number; username: string; password: string }[];
  settings: SettingsMap;
  cash: CashTxn[];
  customers: { id: number; name: string; mobile: string | null; address: string | null; created_at: string }[];
  udhar: UdharEntry[];
  monthly: MonthlyClient[];
  monthly_payments: MonthlyPayment[];
  deliveries: CustomerDelivery[];
  pauses: DeliveryPause[];
  suppliers: { id: number; name: string; mobile: string | null; address: string | null; created_at: string }[];
  categories: PurchaseCategory[];
  purchases: PurchaseEntry[];
  session: User | null;
  counter: number;
};
function blank(): Store {
  return {
    users: [{ id: 1, username: "admin", password: "admin123" }],
    settings: { shop_name: "Milk Shop", logo_data_url: "", language: "en", printer_name: "", receipt_width: "80", invoice_counter: "1000" },
    cash: [], customers: [], udhar: [], monthly: [], monthly_payments: [], deliveries: [], pauses: [], suppliers: [],
    categories: [
      { id: 1, name: "Milk Purchase", kind: "item", is_custom: 0 },
      { id: 2, name: "Dairy Products", kind: "item", is_custom: 0 },
      { id: 3, name: "Shop Supplies", kind: "item", is_custom: 0 },
      { id: 4, name: "Miscellaneous", kind: "item", is_custom: 0 },
      { id: 5, name: "Utilities", kind: "expense", is_custom: 0 },
      { id: 6, name: "Transportation", kind: "expense", is_custom: 0 },
      { id: 7, name: "Maintenance", kind: "expense", is_custom: 0 },
      { id: 8, name: "Other Expense", kind: "expense", is_custom: 0 },
    ],
    purchases: [], session: null, counter: 1000,
  };
}
function load(): Store {
  if (typeof window === "undefined") return blank();
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch {}
  const s = blank(); save(s); return s;
}
function save(s: Store) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} }
function nextId(arr: { id: number }[]) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }
const today = () => new Date().toISOString().slice(0, 10);

function printViaIframe(html: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve({ ok: false, error: "No document" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    const done = () => { setTimeout(() => iframe.remove(), 800); resolve({ ok: true }); };
    iframe.onload = () => { try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch {} done(); };
    setTimeout(done, 3000);
  });
}

function clientBal(s: Store, cid: number) {
  const charges = s.deliveries.filter(d => d.client_id === cid).reduce((a, d) => a + d.amount, 0);
  const paid = s.monthly_payments.filter(p => p.client_id === cid).reduce((a, p) => a + p.amount, 0);
  return { charges, paid, balance: charges - paid };
}

function stubApi(): NonNullable<Window["api"]> {
  return {
    isElectron: false,
    auth: {
      async login(u, p) { const s = load(); const user = s.users.find(x => x.username === u && x.password === p); if (!user) return { ok: false, error: "Invalid credentials" }; s.session = { id: user.id, username: user.username }; save(s); return { ok: true, user: s.session }; },
      async session() { return load().session; },
      async logout() { const s = load(); s.session = null; save(s); return { ok: true }; },
      async change(cur, nu, np) { const s = load(); if (!s.session) return { ok: false, error: "Not logged in" }; const u = s.users.find(x => x.id === s.session!.id)!; if (u.password !== cur) return { ok: false, error: "Current password is wrong" }; if (nu) u.username = nu; if (np) u.password = np; s.session = { id: u.id, username: u.username }; save(s); return { ok: true, user: s.session }; },
    },
    setup: {
      async status() { const s = load(); return { complete: s.settings.first_install_complete === "1" }; },
      async complete(p) {
        const s = load();
        if (!p.username || (p.password || "").length < 4) return { ok: false, error: "Username required and password must be at least 4 characters" };
        s.users = [{ id: 1, username: p.username, password: p.password }];
        if (p.shop_name != null) s.settings.shop_name = p.shop_name;
        if (p.logo_data_url != null) s.settings.logo_data_url = p.logo_data_url;
        if (p.printer_name != null) s.settings.printer_name = p.printer_name;
        s.settings.first_install_complete = "1";
        save(s);
        return { ok: true };
      },
    },
    settings: {
      async getAll() { return load().settings; },
      async set(k, v) { const s = load(); s.settings[k] = String(v ?? ""); save(s); return { ok: true }; },
      async getPrinters() { return []; },
    },
    cash: {
      async add(amount) { const s = load(); s.counter = parseInt(s.settings.invoice_counter || "1000", 10) + 1; s.settings.invoice_counter = String(s.counter); const row: CashTxn = { id: nextId(s.cash), invoice_no: s.counter, amount: Number(amount), created_at: new Date().toISOString() }; s.cash.unshift(row); save(s); return row; },
      async recent(limit = 20) { return load().cash.slice(0, limit); },
      async todayTotal() { const t = today(); const arr = load().cash.filter(x => x.created_at.slice(0, 10) === t); return { total: arr.reduce((a, b) => a + b.amount, 0), count: arr.length }; },
      async range(from, to) { const map = new Map<string, number>(); for (const c of load().cash) { const d = c.created_at.slice(0, 10); if (d >= from && d <= to) map.set(d, (map.get(d) ?? 0) + c.amount); } return Array.from(map, ([day, total]) => ({ day, total })).sort((a, b) => a.day.localeCompare(b.day)); },
      async sum(from, to) { const arr = load().cash.filter(c => { const d = c.created_at.slice(0, 10); return d >= from && d <= to; }); return { total: arr.reduce((a, b) => a + b.amount, 0), count: arr.length }; },
    },
    udhar: {
      async customers() { const s = load(); return s.customers.map(c => ({ ...c, balance: s.udhar.filter(e => e.customer_id === c.id).reduce((a, e) => a + (e.type === "credit" ? e.amount : -e.amount), 0) })); },
      async customer(id) { const c = load().customers.find(x => x.id === id); return c ? { ...c, balance: 0 } : null; },
      async addCustomer(i) { const s = load(); const row = { id: nextId(s.customers), name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at: new Date().toISOString() }; s.customers.push(row); save(s); return { ...row, balance: 0 }; },
      async deleteCustomer(id) { const s = load(); s.customers = s.customers.filter(c => c.id !== id); s.udhar = s.udhar.filter(e => e.customer_id !== id); save(s); return { ok: true }; },
      async entries(customerId) { return load().udhar.filter(e => e.customer_id === customerId).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id); },
      async addEntry(i) { const s = load(); const row: UdharEntry = { id: nextId(s.udhar), customer_id: i.customerId, type: i.type, amount: Number(i.amount), note: i.note ?? null, entry_date: i.entry_date ?? today(), created_at: new Date().toISOString() }; s.udhar.push(row); save(s); return row; },
      async totals(from, to) { const s = load(); const inR = (e: UdharEntry) => e.entry_date >= from && e.entry_date <= to; const cr = s.udhar.filter(e => e.type==="credit" && inR(e)).reduce((a,e)=>a+e.amount,0); const pm = s.udhar.filter(e => e.type==="payment" && inR(e)).reduce((a,e)=>a+e.amount,0); const out = s.udhar.reduce((a,e)=>a+(e.type==="credit"?e.amount:-e.amount),0); return { credit: cr, payment: pm, outstanding: out }; },
    },
    monthly: {
      async list() {
        const s = load();
        const period = new Date().toISOString().slice(0, 7);
        const td = today();
        return s.monthly.map(c => {
          const b = clientBal(s, c.id);
          const monthDeliv = s.deliveries.filter(d => d.client_id === c.id && d.entry_date.startsWith(period));
          const monthAmount = monthDeliv.reduce((a, d) => a + d.amount, 0);
          const monthQty = monthDeliv.reduce((a, d) => a + d.delivered_qty, 0);
          const paidMonth = s.monthly_payments.filter(p => p.client_id === c.id && p.period === period).reduce((a, p) => a + p.amount, 0);
          const pause = s.pauses.find(p => p.client_id === c.id && p.start_date <= td && p.end_date >= td);
          return { ...c, month_amount: monthAmount, month_qty: monthQty, paid_this_month: paidMonth, paid_total: b.paid, total_charges: b.charges, balance: b.balance, paused: pause ? 1 : 0, pause_end: pause?.end_date ?? null };
        });
      },
      async client(id) { const s = load(); const c = s.monthly.find(x => x.id === id); if (!c) return null; return { ...c, ...clientBal(s, id) }; },
      async add(i) { const s = load(); const row: MonthlyClient = { id: nextId(s.monthly), name: i.name ?? "", mobile: i.mobile ?? null, address: i.address ?? null, daily_qty: Number(i.daily_qty ?? 0), milk_type: i.milk_type ?? "cow", rate: Number(i.rate ?? 0), active: i.active === 0 ? 0 : 1, created_at: new Date().toISOString() }; s.monthly.push(row); save(s); return row; },
      async update(i) { const s = load(); const idx = s.monthly.findIndex(x => x.id === i.id); if (idx >= 0) s.monthly[idx] = { ...s.monthly[idx], ...i } as MonthlyClient; save(s); return { ok: true }; },
      async delete(id) { const s = load(); s.monthly = s.monthly.filter(c => c.id !== id); s.monthly_payments = s.monthly_payments.filter(p => p.client_id !== id); s.deliveries = s.deliveries.filter(d => d.client_id !== id); s.pauses = s.pauses.filter(p => p.client_id !== id); save(s); return { ok: true }; },
      async deliveries(from, to, clientId) { const s = load(); return s.deliveries.filter(d => (!from || d.entry_date >= from) && (!to || d.entry_date <= to) && (!clientId || d.client_id === clientId)).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id); },
      async deliveriesForDate(date) { return load().deliveries.filter(d => d.entry_date === date); },
      async saveDeliveries(date, rows) {
        const s = load();
        for (const r of rows) {
          const idx = s.deliveries.findIndex(d => d.client_id === r.client_id && d.entry_date === date);
          const row: CustomerDelivery = { id: idx >= 0 ? s.deliveries[idx].id : nextId(s.deliveries), client_id: r.client_id, entry_date: date, default_qty: r.default_qty, delivered_qty: r.delivered_qty, rate: r.rate, amount: r.amount, milk_type: r.milk_type ?? null, status: r.status ?? "delivered", note: r.note ?? null, created_at: new Date().toISOString() };
          if (idx >= 0) s.deliveries[idx] = row; else s.deliveries.push(row);
        }
        save(s); return { ok: true, count: rows.length };
      },
      async deleteDelivery(id) { const s = load(); s.deliveries = s.deliveries.filter(d => d.id !== id); save(s); return { ok: true }; },
      async pauses(clientId) { return load().pauses.filter(p => p.client_id === clientId).sort((a, b) => b.start_date.localeCompare(a.start_date)); },
      async addPause(i) { const s = load(); const row: DeliveryPause = { id: nextId(s.pauses), client_id: i.clientId, start_date: i.start_date, end_date: i.end_date, reason: i.reason ?? null, created_at: new Date().toISOString() }; s.pauses.push(row); save(s); return row; },
      async deletePause(id) { const s = load(); s.pauses = s.pauses.filter(p => p.id !== id); save(s); return { ok: true }; },
      async payments(clientId) { return load().monthly_payments.filter(p => p.client_id === clientId).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id); },
      async addPayment(i) { const s = load(); const d = i.entry_date ?? today(); const row: MonthlyPayment = { id: nextId(s.monthly_payments), client_id: i.clientId, period: i.period ?? d.slice(0, 7), amount: Number(i.amount), note: i.note ?? null, entry_date: d, created_at: new Date().toISOString() }; s.monthly_payments.push(row); save(s); return row; },
      async deletePayment(id) { const s = load(); s.monthly_payments = s.monthly_payments.filter(p => p.id !== id); save(s); return { ok: true }; },
      async totals(from, to) { const s = load(); const charges = s.deliveries.filter(d => d.entry_date >= from && d.entry_date <= to).reduce((a, d) => a + d.amount, 0); const paid = s.monthly_payments.filter(p => p.entry_date >= from && p.entry_date <= to).reduce((a, p) => a + p.amount, 0); const allCharges = s.deliveries.reduce((a, d) => a + d.amount, 0); const allPaid = s.monthly_payments.reduce((a, p) => a + p.amount, 0); return { charges, paid, outstanding: allCharges - allPaid }; },
    },
    purchases: {
      async suppliers() { const s = load(); return s.suppliers.map(sup => { const balance = s.purchases.filter(e => e.supplier_id === sup.id).reduce((a, e) => a + (e.type === "purchase" ? e.amount : -e.amount), 0); return { ...sup, balance }; }); },
      async supplier(id) { const c = load().suppliers.find(x => x.id === id); return c ? { ...c, balance: 0 } : null; },
      async addSupplier(i) { const s = load(); const row = { id: nextId(s.suppliers), name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at: new Date().toISOString() }; s.suppliers.push(row); save(s); return { ...row, balance: 0 }; },
      async deleteSupplier(id) { const s = load(); s.suppliers = s.suppliers.filter(c => c.id !== id); s.purchases = s.purchases.filter(e => e.supplier_id !== id); save(s); return { ok: true }; },
      async supplierEntries(supplierId) { return load().purchases.filter(e => e.supplier_id === supplierId).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id); },
      async categories() { return load().categories.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)); },
      async addCategory(i) { const s = load(); const row: PurchaseCategory = { id: nextId(s.categories), name: i.name, kind: i.kind, is_custom: 1 }; s.categories.push(row); save(s); return row; },
      async deleteCategory(id) { const s = load(); s.categories = s.categories.filter(c => !(c.id === id && c.is_custom)); save(s); return { ok: true }; },
      async entries(f = {}) {
        const s = load(); const ql = f.q?.toLowerCase();
        return s.purchases.filter(e => {
          const cat = s.categories.find(c => c.id === e.category_id);
          if (f.from && e.entry_date < f.from) return false;
          if (f.to && e.entry_date > f.to) return false;
          if (f.categoryId && e.category_id !== f.categoryId) return false;
          if (f.kind && cat?.kind !== f.kind) return false;
          if (ql) {
            const sup = s.suppliers.find(x => x.id === e.supplier_id);
            const hay = `${e.item_name||""} ${e.note||""} ${sup?.name||""}`.toLowerCase();
            if (!hay.includes(ql)) return false;
          }
          return true;
        }).map(e => { const cat = s.categories.find(c => c.id === e.category_id); const sup = s.suppliers.find(x => x.id === e.supplier_id); return { ...e, category_name: cat?.name ?? null, category_kind: cat?.kind ?? null, supplier_name: sup?.name ?? null }; })
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id);
      },
      async addEntry(p) {
        const s = load(); const d = p.entry_date ?? today();
        const amount = p.amount != null ? Number(p.amount) : (Number(p.qty)||0) * (Number(p.rate)||0);
        const row: PurchaseEntry = { id: nextId(s.purchases), entry_date: d, category_id: p.categoryId ?? null, supplier_id: p.supplierId ?? null, item_name: p.itemName ?? null, qty: p.qty != null ? Number(p.qty) : null, unit: p.unit ?? null, rate: p.rate != null ? Number(p.rate) : null, amount, paid_now: Number(p.paidNow) || 0, type: p.type ?? "purchase", note: p.note ?? null };
        s.purchases.push(row);
        if ((p.type ?? "purchase") === "purchase" && Number(p.paidNow) > 0 && p.supplierId) {
          s.purchases.push({ id: nextId(s.purchases), entry_date: d, category_id: null, supplier_id: p.supplierId, item_name: null, qty: null, unit: null, rate: null, amount: Number(p.paidNow), paid_now: 0, type: "payment", note: "Paid with purchase" });
        }
        save(s); return { ok: true };
      },
      async deleteEntry(id) { const s = load(); s.purchases = s.purchases.filter(e => e.id !== id); save(s); return { ok: true }; },
      async totals(args = {}) {
        const s = load(); const td = today(); const m = td.slice(0, 7);
        const items = s.purchases.filter(e => e.type === "purchase").map(e => ({ e, cat: s.categories.find(c => c.id === e.category_id) }));
        const isItem = (c: PurchaseCategory | undefined) => !c || c.kind === "item";
        const isExp = (c: PurchaseCategory | undefined) => c?.kind === "expense";
        return {
          today: items.filter(x => x.e.entry_date === td && isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0),
          month: items.filter(x => x.e.entry_date.startsWith(m) && isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0),
          all: items.filter(x => isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0),
          range_items: args.from && args.to ? items.filter(x => x.e.entry_date >= args.from! && x.e.entry_date <= args.to! && isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0) : 0,
          range_expenses: args.from && args.to ? items.filter(x => x.e.entry_date >= args.from! && x.e.entry_date <= args.to! && isExp(x.cat)).reduce((a, x) => a + x.e.amount, 0) : 0,
        };
      },
      async expensesByCategory(from, to) {
        const s = load();
        return s.categories.filter(c => c.kind === "expense").map(c => {
          const total = s.purchases.filter(e => e.type === "purchase" && e.category_id === c.id && e.entry_date >= from && e.entry_date <= to).reduce((a, e) => a + e.amount, 0);
          return { name: c.name, total };
        });
      },
    },
    supplierLedger: (() => {
      const KEY = "milkshop_sl_v1";
      type SL = { suppliers: SupplierV2[]; purchases: any[]; payments: any[] };
      const ld = (): SL => { try { return JSON.parse(localStorage.getItem(KEY) || "") || { suppliers: [], purchases: [], payments: [] }; } catch { return { suppliers: [], purchases: [], payments: [] }; } };
      const sv = (s: SL) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
      const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
      const outstanding = (s: SL, id: string) => {
        const sup = s.suppliers.find(x => x.id === id); if (!sup) return 0;
        const p = s.purchases.filter(x => x.supplier_id === id && x.payment_mode === "credit" && !x.deleted_at).reduce((a, x) => a + x.amount, 0);
        const pay = s.payments.filter(x => x.supplier_id === id && !x.deleted_at).reduce((a, x) => a + x.amount, 0);
        return (sup.opening_balance || 0) + p - pay;
      };
      return {
        async suppliers(q) { const s = ld(); const ql = (q || "").toLowerCase(); return s.suppliers.filter(r => !r.deleted_at && (!ql || (r.name + " " + (r.mobile||"") + " " + (r.address||"")).toLowerCase().includes(ql))).map(r => ({ ...r, outstanding: outstanding(s, r.id) })); },
        async supplier(id) { const s = ld(); const r = s.suppliers.find(x => x.id === id && !x.deleted_at); return r ? { ...r, outstanding: outstanding(s, id) } : null; },
        async addSupplier(i) { const s = ld(); const now = new Date().toISOString(); const r: SupplierV2 = { id: newId(), name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, opening_balance: Number(i.opening_balance) || 0, notes: i.notes ?? null, deleted_at: null, created_at: now, updated_at: now, created_by: null, updated_by: null }; s.suppliers.push(r); sv(s); return r; },
        async updateSupplier(i) { const s = ld(); const r = s.suppliers.find(x => x.id === i.id); if (r) { Object.assign(r, { name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, opening_balance: Number(i.opening_balance) || 0, notes: i.notes ?? null, updated_at: new Date().toISOString() }); sv(s); } return { ok: true }; },
        async deleteSupplier(id) { const s = ld(); const r = s.suppliers.find(x => x.id === id); if (r) { r.deleted_at = new Date().toISOString(); sv(s); } return { ok: true }; },
        async ledger({ supplierId, from, to, q }) {
          const s = ld(); const fromD = from || "0000-01-01", toD = to || "9999-12-31"; const ql = (q || "").toLowerCase();
          const sup = s.suppliers.find(x => x.id === supplierId);
          const priorP = s.purchases.filter(x => x.supplier_id === supplierId && x.payment_mode === "credit" && !x.deleted_at && x.entry_date < fromD).reduce((a, x) => a + x.amount, 0);
          const priorPay = s.payments.filter(x => x.supplier_id === supplierId && !x.deleted_at && x.entry_date < fromD).reduce((a, x) => a + x.amount, 0);
          let bal = (sup?.opening_balance || 0) + priorP - priorPay;
          const opening = bal;
          const purchases = s.purchases.filter(x => x.supplier_id === supplierId && !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).map(x => ({ ...x, kind: "purchase" as const }));
          const payments = s.payments.filter(x => x.supplier_id === supplierId && !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).map(x => ({ ...x, kind: "payment" as const }));
          let entries = [...purchases, ...payments];
          if (ql) entries = entries.filter(e => `${e.item_name||""} ${e.invoice_no||""} ${e.reference_no||""} ${e.notes||""} ${e.mode||""}`.toLowerCase().includes(ql));
          entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || String(a.id).localeCompare(String(b.id)));
          const rows: SupplierLedgerRow[] = entries.map(e => {
            if (e.kind === "purchase") { const debit = e.payment_mode === "credit" ? e.amount : 0; bal += debit; return { ...e, debit, credit: 0, balance: bal }; }
            else { bal -= e.amount; return { ...e, debit: 0, credit: e.amount, balance: bal }; }
          });
          return { opening, rows, closing: bal };
        },
        async addPurchase(i) { const s = ld(); const id = newId(); const now = new Date().toISOString(); const amount = i.amount != null ? Number(i.amount) : (Number(i.qty)||0) * (Number(i.rate)||0); s.purchases.push({ id, supplier_id: i.supplier_id, entry_date: i.entry_date || today(), invoice_no: i.invoice_no ?? null, item_name: i.item_name ?? null, qty: i.qty ?? null, unit: i.unit ?? null, rate: i.rate ?? null, amount, payment_mode: i.payment_mode || "credit", notes: i.notes ?? null, deleted_at: null, created_at: now, updated_at: now }); sv(s); return { ok: true, id }; },
        async addPayment(i) { const s = ld(); const id = newId(); const now = new Date().toISOString(); s.payments.push({ id, supplier_id: i.supplier_id, entry_date: i.entry_date || today(), amount: Number(i.amount), mode: i.mode || "cash", reference_no: i.reference_no ?? null, notes: i.notes ?? null, deleted_at: null, created_at: now, updated_at: now }); sv(s); return { ok: true, id }; },
        async deletePurchase(id) { const s = ld(); const r = s.purchases.find(x => x.id === id); if (r) { r.deleted_at = new Date().toISOString(); sv(s); } return { ok: true }; },
        async deletePayment(id) { const s = ld(); const r = s.payments.find(x => x.id === id); if (r) { r.deleted_at = new Date().toISOString(); sv(s); } return { ok: true }; },
        async totals(args = {}) { const s = ld(); const fromD = args.from || "0000-01-01", toD = args.to || "9999-12-31"; const purchases = s.purchases.filter(x => !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).reduce((a, x) => a + x.amount, 0); const payments = s.payments.filter(x => !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).reduce((a, x) => a + x.amount, 0); const out = s.suppliers.filter(x => !x.deleted_at).reduce((a, sup) => a + outstanding(s, sup.id), 0); return { purchases, payments, outstanding: out }; },
      };
    })(),
    print: {
      async receipt(p) {
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>
          @page{size:80mm auto;margin:0}
          html,body{margin:0;padding:0}
          body{width:80mm;font-family:'Courier New',monospace;color:#000;padding:4mm 3mm;text-align:center}
          .logo{max-height:14mm;max-width:60%;object-fit:contain;display:block;margin:0 auto 2mm}
          .inv{text-align:left;font-size:10pt;font-weight:700;margin-bottom:3mm}
          .amt-box{border:2px solid #000;border-radius:2mm;padding:4mm 2mm;margin:2mm 0}
          .amt{font-size:26pt;font-weight:900;letter-spacing:1px;line-height:1}
          .foot{margin-top:5mm;font-size:8pt;font-style:italic;border-top:1px dashed #000;padding-top:2mm}
        </style></head><body>
          ${p.logo_data_url?`<img class="logo" src="${p.logo_data_url}"/>`:''}
          <div class="inv">Invoice #${p.invoice_no}<br/><span style="font-weight:400">${p.date}</span></div>
          <div class="amt-box"><div class="amt">Rs. ${Number(p.amount).toLocaleString()}</div></div>
          <div class="foot">Designed &amp; developed by Zubair Khan</div>
        </body></html>`;
        return printViaIframe(html);
      },
      async test() { alert("Test print is only available in the desktop build."); return { ok: false }; },
      async html(html) { return printViaIframe(html); },
    },
    data: {
      async backup() { alert("Backup is only available in the desktop build."); return { ok: false }; },
      async restore() { alert("Restore is only available in the desktop build."); return { ok: false }; },
      async clearAll() { localStorage.removeItem(LS_KEY); return { ok: true }; },
    },
  };
}

export function api() {
  if (typeof window !== "undefined" && window.api) return window.api;
  if (typeof window !== "undefined") {
    if (!(window as any).__stubApi) (window as any).__stubApi = stubApi();
    return (window as any).__stubApi as NonNullable<Window["api"]>;
  }
  return stubApi();
}

export const isElectron = () => typeof window !== "undefined" && !!window.api?.isElectron;
