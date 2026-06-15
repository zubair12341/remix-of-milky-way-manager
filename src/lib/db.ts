// Typed bridge to Electron main process (window.api).
// In the Lovable browser preview window.api is undefined, so we fall back to a
// localStorage-backed stub so UI iteration still works.

export type User = { id: number; username: string };
export type CashTxn = { id: number; invoice_no: number; amount: number; created_at: string };
export type UdharCustomer = { id: number; name: string; mobile: string | null; address: string | null; created_at: string; balance: number };
export type UdharEntry = { id: number; customer_id: number; type: "credit" | "payment"; amount: number; note: string | null; entry_date: string; created_at: string };
export type MonthlyClient = { id: number; name: string; mobile: string | null; daily_qty: number; milk_type: string; rate: number; active: number; created_at: string };
export type SettingsMap = Record<string, string>;
export type PrinterInfo = { name: string; displayName: string; isDefault: boolean; status: number };
export type Supplier = { id: number; name: string; mobile: string | null; address: string | null; created_at: string; balance: number };
export type PurchaseEntry = { id: number; supplier_id: number; type: "purchase" | "payment"; amount: number; qty: number | null; rate: number | null; note: string | null; entry_date: string; created_at: string };
export type PurchaseTotals = { today: number; month: number; all: number };

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
      };
      udhar: {
        customers: () => Promise<UdharCustomer[]>;
        customer: (id: number) => Promise<UdharCustomer | null>;
        addCustomer: (i: { name: string; mobile?: string; address?: string }) => Promise<UdharCustomer>;
        deleteCustomer: (id: number) => Promise<{ ok: boolean }>;
        entries: (customerId: number) => Promise<UdharEntry[]>;
        addEntry: (i: { customerId: number; type: "credit" | "payment"; amount: number; note?: string; entry_date?: string }) => Promise<UdharEntry>;
      };
      monthly: {
        list: () => Promise<MonthlyClient[]>;
        add: (i: Partial<MonthlyClient>) => Promise<MonthlyClient>;
        update: (i: Partial<MonthlyClient> & { id: number }) => Promise<{ ok: boolean }>;
        delete: (id: number) => Promise<{ ok: boolean }>;
      };
      purchases: {
        suppliers: () => Promise<Supplier[]>;
        supplier: (id: number) => Promise<Supplier | null>;
        addSupplier: (i: { name: string; mobile?: string; address?: string }) => Promise<Supplier>;
        deleteSupplier: (id: number) => Promise<{ ok: boolean }>;
        entries: (supplierId: number) => Promise<PurchaseEntry[]>;
        addEntry: (i: { supplierId: number; type: "purchase" | "payment"; amount: number; qty?: number; rate?: number; paid_now?: number; note?: string; entry_date?: string }) => Promise<{ ok: boolean }>;
        totals: () => Promise<PurchaseTotals>;
      };
      print: {
        receipt: (p: { invoice_no: number | string; amount: number; date: string; shop_name: string; logo_data_url?: string }) => Promise<{ ok: boolean; error?: string | null }>;
        test: () => Promise<{ ok: boolean; error?: string | null }>;
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
const LS_KEY = "milkshop_stub_v1";
type Store = {
  users: { id: number; username: string; password: string }[];
  settings: SettingsMap;
  cash: CashTxn[];
  customers: { id: number; name: string; mobile: string | null; address: string | null; created_at: string }[];
  udhar: UdharEntry[];
  monthly: MonthlyClient[];
  suppliers: { id: number; name: string; mobile: string | null; address: string | null; created_at: string }[];
  purchases: PurchaseEntry[];
  session: User | null;
  counter: number;
};
function load(): Store {
  if (typeof window === "undefined") return blank();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const s = blank();
  save(s);
  return s;
}
function blank(): Store {
  return {
    users: [{ id: 1, username: "admin", password: "admin123" }],
    settings: { shop_name: "Milk Shop", logo_data_url: "", language: "en", printer_name: "", receipt_width: "80", invoice_counter: "1000" },
    cash: [],
    customers: [],
    udhar: [],
    monthly: [],
    suppliers: [],
    purchases: [],
    session: null,
    counter: 1000,
  };
}
function save(s: Store) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} }
function nextId(arr: { id: number }[]) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

function stubApi(): NonNullable<Window["api"]> {
  return {
    isElectron: false,
    auth: {
      async login(u, p) {
        const s = load();
        const user = s.users.find(x => x.username === u && x.password === p);
        if (!user) return { ok: false, error: "Invalid credentials" };
        s.session = { id: user.id, username: user.username }; save(s);
        return { ok: true, user: s.session };
      },
      async session() { return load().session; },
      async logout() { const s = load(); s.session = null; save(s); return { ok: true }; },
      async change(cur, nu, np) {
        const s = load(); if (!s.session) return { ok: false, error: "Not logged in" };
        const user = s.users.find(x => x.id === s.session!.id)!;
        if (user.password !== cur) return { ok: false, error: "Current password is wrong" };
        if (nu) user.username = nu;
        if (np) user.password = np;
        s.session = { id: user.id, username: user.username }; save(s);
        return { ok: true, user: s.session };
      },
    },
    settings: {
      async getAll() { return load().settings; },
      async set(k, v) { const s = load(); s.settings[k] = String(v ?? ""); save(s); return { ok: true }; },
      async getPrinters() { return []; },
    },
    cash: {
      async add(amount) {
        const s = load(); s.counter = (parseInt(s.settings.invoice_counter || "1000", 10) + 1);
        s.settings.invoice_counter = String(s.counter);
        const row: CashTxn = { id: nextId(s.cash), invoice_no: s.counter, amount: Number(amount), created_at: new Date().toISOString() };
        s.cash.unshift(row); save(s); return row;
      },
      async recent(limit = 20) { return load().cash.slice(0, limit); },
      async todayTotal() {
        const t = new Date().toISOString().slice(0, 10);
        const arr = load().cash.filter(x => x.created_at.slice(0, 10) === t);
        return { total: arr.reduce((a, b) => a + b.amount, 0), count: arr.length };
      },
      async range(from, to) {
        const map = new Map<string, number>();
        for (const c of load().cash) {
          const d = c.created_at.slice(0, 10);
          if (d >= from && d <= to) map.set(d, (map.get(d) ?? 0) + c.amount);
        }
        return Array.from(map, ([day, total]) => ({ day, total })).sort((a, b) => a.day.localeCompare(b.day));
      },
    },
    udhar: {
      async customers() {
        const s = load();
        return s.customers.map(c => {
          const balance = s.udhar.filter(e => e.customer_id === c.id).reduce((a, e) => a + (e.type === "credit" ? e.amount : -e.amount), 0);
          return { ...c, balance };
        });
      },
      async customer(id) { const c = load().customers.find(x => x.id === id); return c ? { ...c, balance: 0 } : null; },
      async addCustomer(i) {
        const s = load();
        const row = { id: nextId(s.customers), name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at: new Date().toISOString() };
        s.customers.push(row); save(s); return { ...row, balance: 0 };
      },
      async deleteCustomer(id) { const s = load(); s.customers = s.customers.filter(c => c.id !== id); s.udhar = s.udhar.filter(e => e.customer_id !== id); save(s); return { ok: true }; },
      async entries(customerId) { return load().udhar.filter(e => e.customer_id === customerId).sort((a, b) => b.entry_date.localeCompare(a.entry_date)); },
      async addEntry(i) {
        const s = load();
        const row: UdharEntry = { id: nextId(s.udhar), customer_id: i.customerId, type: i.type, amount: Number(i.amount), note: i.note ?? null, entry_date: i.entry_date ?? new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() };
        s.udhar.push(row); save(s); return row;
      },
    },
    monthly: {
      async list() { return load().monthly; },
      async add(i) {
        const s = load();
        const row: MonthlyClient = { id: nextId(s.monthly), name: i.name ?? "", mobile: i.mobile ?? null, daily_qty: Number(i.daily_qty ?? 0), milk_type: i.milk_type ?? "cow", rate: Number(i.rate ?? 0), active: 1, created_at: new Date().toISOString() };
        s.monthly.push(row); save(s); return row;
      },
      async update(i) {
        const s = load(); const idx = s.monthly.findIndex(x => x.id === i.id);
        if (idx >= 0) s.monthly[idx] = { ...s.monthly[idx], ...i } as MonthlyClient;
        save(s); return { ok: true };
      },
      async delete(id) { const s = load(); s.monthly = s.monthly.filter(c => c.id !== id); save(s); return { ok: true }; },
    },
    print: {
      async receipt(p) {
        // Fallback: open print dialog with a small receipt
        const w = window.open("", "_blank", "width=320,height=480");
        if (!w) return { ok: false, error: "Popup blocked" };
        w.document.write(`<style>body{font-family:monospace;text-align:center;padding:8px;width:80mm}</style>
          ${p.logo_data_url ? `<img src="${p.logo_data_url}" style="max-height:60px"/>` : ""}
          <h3>${p.shop_name}</h3><p>Invoice #${p.invoice_no}<br>${p.date}</p>
          <h1>Rs. ${p.amount}</h1>`);
        w.document.close(); w.focus(); w.print(); setTimeout(() => w.close(), 500);
        return { ok: true };
      },
      async test() { alert("Test print is only available in the desktop build."); return { ok: false }; },
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
  // SSR — return a no-op proxy
  return stubApi();
}

export const isElectron = () => typeof window !== "undefined" && !!window.api?.isElectron;
