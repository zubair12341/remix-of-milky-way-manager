// Offline-first API surface for the PWA. Preserves the exact public shape
// that every route/component consumes (api().cash.add, api().udhar.customers,
// etc.), backed by IndexedDB (Dexie) instead of localStorage. Every mutating
// call also appends an outbox row so the sync engine can push it to Supabase
// once the device is online and paired with a business.
//
// Local integer PKs are kept for UI compatibility. Each syncable row also
// carries a stable `sync_uuid` (generated on insert) which is what the cloud
// upserts against — that is how integer-keyed local rows survive the round
// trip to a UUID-keyed cloud schema without the UI having to change.

import bcrypt from "bcryptjs";
import { db, ensureSeed, uuid, type CloudTable, type OutboxRow } from "@/lib/local-db";
import { getPairing } from "@/lib/cloud";

// ---- Public types (unchanged from the previous stub — kept 1:1) ----
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

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

// ---- Outbox helper ----
async function enqueue(table: CloudTable, op: "upsert" | "delete", payload: Record<string, unknown> & { id: string; sync_version?: number }) {
  const row: OutboxRow = {
    table,
    op,
    payload: { ...payload, sync_version: payload.sync_version ?? 1 },
    created_at: nowIso(),
    attempts: 0,
    last_error: null,
  };
  await db().outbox.add(row);
  // Nudge the sync engine — lazily loaded to avoid a cycle.
  try {
    const mod = await import("@/lib/sync-engine");
    void mod.syncNow();
  } catch {
    /* sync engine optional */
  }
}

// ---- Print (browser-native via hidden iframe) ----
function printViaIframe(html: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve({ ok: false, error: "No document" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    const done = () => { setTimeout(() => iframe.remove(), 800); resolve({ ok: true }); };
    iframe.onload = () => { try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch { /* ignore */ } done(); };
    setTimeout(done, 3000);
  });
}

// ---- Settings helpers ----
async function getSetting(key: string, fallback = ""): Promise<string> {
  const r = await db().settings.get(key);
  return r?.value ?? fallback;
}
async function setSetting(key: string, value: string) {
  await db().settings.put({ key, value });
}
async function allSettings(): Promise<SettingsMap> {
  const rows = await db().settings.toArray();
  const out: SettingsMap = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ---- The API surface ----
function buildApi() {
  const d = db();
  return {
    isElectron: false,

    auth: {
      async login(username: string, password: string): Promise<{ ok: boolean; user?: User; error?: string }> {
        const u = await d.users.where("username").equals(username).first();
        if (!u || !u.id) return { ok: false, error: "Invalid credentials" };
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return { ok: false, error: "Invalid credentials" };
        await d.session.put({ key: "session", user_id: u.id, username: u.username });
        return { ok: true, user: { id: u.id, username: u.username } };
      },
      async session(): Promise<User | null> {
        const s = await d.session.get("session");
        return s ? { id: s.user_id, username: s.username } : null;
      },
      async logout() { await d.session.delete("session"); return { ok: true }; },
      async change(cur: string, nu: string, np: string): Promise<{ ok: boolean; user?: User; error?: string }> {
        const s = await d.session.get("session");
        if (!s) return { ok: false, error: "Not logged in" };
        const u = await d.users.get(s.user_id);
        if (!u || !u.id) return { ok: false, error: "User missing" };
        const ok = await bcrypt.compare(cur, u.password_hash);
        if (!ok) return { ok: false, error: "Current password is wrong" };
        const patch: Partial<typeof u> = {};
        if (nu) patch.username = nu;
        if (np) patch.password_hash = await bcrypt.hash(np, 10);
        await d.users.update(u.id, patch);
        const final = { id: u.id, username: nu || u.username };
        await d.session.put({ key: "session", user_id: final.id, username: final.username });
        return { ok: true, user: final };
      },
    },

    setup: {
      async status(): Promise<{ complete: boolean }> {
        const v = await getSetting("first_install_complete", "0");
        return { complete: v === "1" };
      },
      async complete(p: { username: string; password: string; shop_name?: string; logo_data_url?: string; printer_name?: string }): Promise<{ ok: boolean; error?: string }> {
        if (!p.username || (p.password || "").length < 4) return { ok: false, error: "Username required and password must be at least 4 characters" };
        const hash = await bcrypt.hash(p.password, 10);
        // Fresh install: wipe any prior users, create one owner.
        await d.users.clear();
        await d.users.add({ username: p.username, password_hash: hash });
        if (p.shop_name != null) await setSetting("shop_name", p.shop_name);
        if (p.logo_data_url != null) await setSetting("logo_data_url", p.logo_data_url);
        if (p.printer_name != null) await setSetting("printer_name", p.printer_name);
        await setSetting("first_install_complete", "1");
        return { ok: true };
      },
    },

    settings: {
      async getAll() { return allSettings(); },
      async set(key: string, value: string) { await setSetting(key, String(value ?? "")); return { ok: true }; },
      async getPrinters(): Promise<PrinterInfo[]> { return []; },
    },

    cash: {
      async add(amount: number): Promise<CashTxn> {
        const nextInv = parseInt(await getSetting("invoice_counter", "1000"), 10) + 1;
        await setSetting("invoice_counter", String(nextInv));
        const sync_uuid = uuid();
        const created_at = nowIso();
        const id = await d.cash.add({ sync_uuid, invoice_no: nextInv, amount: Number(amount), created_at });
        await enqueue("cash_sales", "upsert", { id: sync_uuid, amount: Number(amount), slip_number: nextInv, sale_at: created_at });
        return { id, invoice_no: nextInv, amount: Number(amount), created_at };
      },
      async recent(limit = 20): Promise<CashTxn[]> {
        const rows = await d.cash.orderBy("created_at").reverse().limit(limit).toArray();
        return rows.map(r => ({ id: r.id!, invoice_no: r.invoice_no, amount: r.amount, created_at: r.created_at }));
      },
      async todayTotal() {
        const t = today();
        const rows = await d.cash.toArray();
        const arr = rows.filter(r => r.created_at.slice(0, 10) === t);
        return { total: arr.reduce((a, b) => a + b.amount, 0), count: arr.length };
      },
      async range(from: string, to: string) {
        const rows = await d.cash.toArray();
        const map = new Map<string, number>();
        for (const c of rows) { const day = c.created_at.slice(0, 10); if (day >= from && day <= to) map.set(day, (map.get(day) ?? 0) + c.amount); }
        return Array.from(map, ([day, total]) => ({ day, total })).sort((a, b) => a.day.localeCompare(b.day));
      },
      async sum(from: string, to: string) {
        const rows = (await d.cash.toArray()).filter(c => { const dt = c.created_at.slice(0, 10); return dt >= from && dt <= to; });
        return { total: rows.reduce((a, b) => a + b.amount, 0), count: rows.length };
      },
    },

    udhar: {
      async customers(): Promise<UdharCustomer[]> {
        const [cs, es] = await Promise.all([d.udhar_customers.toArray(), d.udhar_entries.toArray()]);
        return cs.map(c => ({
          id: c.id!, name: c.name, mobile: c.mobile, address: c.address, created_at: c.created_at,
          balance: es.filter(e => e.customer_id === c.id).reduce((a, e) => a + (e.type === "credit" ? e.amount : -e.amount), 0),
        }));
      },
      async customer(id: number): Promise<UdharCustomer | null> {
        const c = await d.udhar_customers.get(id);
        if (!c) return null;
        const es = await d.udhar_entries.where("customer_id").equals(id).toArray();
        const balance = es.reduce((a, e) => a + (e.type === "credit" ? e.amount : -e.amount), 0);
        return { id: c.id!, name: c.name, mobile: c.mobile, address: c.address, created_at: c.created_at, balance };
      },
      async addCustomer(i: { name: string; mobile?: string; address?: string }): Promise<UdharCustomer> {
        const sync_uuid = uuid();
        const created_at = nowIso();
        const id = await d.udhar_customers.add({ sync_uuid, name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at });
        await enqueue("udhar_customers", "upsert", { id: sync_uuid, name: i.name, mobile: i.mobile ?? null, address: i.address ?? null });
        return { id, name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at, balance: 0 };
      },
      async deleteCustomer(id: number) {
        const c = await d.udhar_customers.get(id);
        const es = await d.udhar_entries.where("customer_id").equals(id).toArray();
        await d.udhar_entries.where("customer_id").equals(id).delete();
        await d.udhar_customers.delete(id);
        if (c) await enqueue("udhar_customers", "upsert", { id: c.sync_uuid, deleted_at: nowIso() });
        for (const e of es) await enqueue("udhar_entries", "upsert", { id: e.sync_uuid, deleted_at: nowIso() });
        return { ok: true };
      },
      async entries(customerId: number): Promise<UdharEntry[]> {
        const rows = await d.udhar_entries.where("customer_id").equals(customerId).toArray();
        return rows.sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.id! - a.id!))
          .map(r => ({ id: r.id!, customer_id: r.customer_id, type: r.type, amount: r.amount, note: r.note, entry_date: r.entry_date, created_at: r.created_at }));
      },
      async addEntry(i: { customerId: number; type: "credit" | "payment"; amount: number; note?: string; entry_date?: string }): Promise<UdharEntry> {
        const parent = await d.udhar_customers.get(i.customerId);
        if (!parent) throw new Error("Customer not found");
        const sync_uuid = uuid();
        const created_at = nowIso();
        const entry_date = i.entry_date ?? today();
        const id = await d.udhar_entries.add({ sync_uuid, customer_id: i.customerId, type: i.type, amount: Number(i.amount), note: i.note ?? null, entry_date, created_at });
        await enqueue("udhar_entries", "upsert", { id: sync_uuid, customer_id: parent.sync_uuid, entry_type: i.type, entry_date, amount: Number(i.amount), notes: i.note ?? null });
        return { id, customer_id: i.customerId, type: i.type, amount: Number(i.amount), note: i.note ?? null, entry_date, created_at };
      },
      async totals(from: string, to: string) {
        const rows = await d.udhar_entries.toArray();
        const inR = (e: typeof rows[number]) => e.entry_date >= from && e.entry_date <= to;
        const credit = rows.filter(e => e.type === "credit" && inR(e)).reduce((a, e) => a + e.amount, 0);
        const payment = rows.filter(e => e.type === "payment" && inR(e)).reduce((a, e) => a + e.amount, 0);
        const outstanding = rows.reduce((a, e) => a + (e.type === "credit" ? e.amount : -e.amount), 0);
        return { credit, payment, outstanding };
      },
    },

    monthly: {
      async list(): Promise<MonthlyClient[]> {
        const [cs, deliv, pays, paus] = await Promise.all([
          d.monthly_clients.toArray(), d.deliveries.toArray(), d.monthly_payments.toArray(), d.pauses.toArray(),
        ]);
        const period = new Date().toISOString().slice(0, 7);
        const td = today();
        return cs.map(c => {
          const cd = deliv.filter(x => x.client_id === c.id);
          const monthDeliv = cd.filter(x => x.entry_date.startsWith(period));
          const charges = cd.reduce((a, x) => a + x.amount, 0);
          const paid = pays.filter(p => p.client_id === c.id).reduce((a, p) => a + p.amount, 0);
          const paidThisMonth = pays.filter(p => p.client_id === c.id && p.period === period).reduce((a, p) => a + p.amount, 0);
          const pause = paus.find(p => p.client_id === c.id && p.start_date <= td && p.end_date >= td);
          return { id: c.id!, name: c.name, mobile: c.mobile, address: c.address, daily_qty: c.daily_qty, milk_type: c.milk_type, rate: c.rate, active: c.active, created_at: c.created_at,
            month_amount: monthDeliv.reduce((a, x) => a + x.amount, 0), month_qty: monthDeliv.reduce((a, x) => a + x.delivered_qty, 0),
            paid_this_month: paidThisMonth, paid_total: paid, total_charges: charges, balance: charges - paid,
            paused: pause ? 1 : 0, pause_end: pause?.end_date ?? null };
        });
      },
      async client(id: number): Promise<MonthlyClient | null> {
        const c = await d.monthly_clients.get(id);
        if (!c) return null;
        const cd = await d.deliveries.where("client_id").equals(id).toArray();
        const pays = await d.monthly_payments.where("client_id").equals(id).toArray();
        const charges = cd.reduce((a, x) => a + x.amount, 0);
        const paid = pays.reduce((a, p) => a + p.amount, 0);
        return { id: c.id!, name: c.name, mobile: c.mobile, address: c.address, daily_qty: c.daily_qty, milk_type: c.milk_type, rate: c.rate, active: c.active, created_at: c.created_at, charges, paid, balance: charges - paid, total_charges: charges, paid_total: paid };
      },
      async add(i: Partial<MonthlyClient>): Promise<MonthlyClient> {
        const sync_uuid = uuid();
        const created_at = nowIso();
        const row = { sync_uuid, name: i.name ?? "", mobile: i.mobile ?? null, address: i.address ?? null, daily_qty: Number(i.daily_qty ?? 0), milk_type: i.milk_type ?? "cow", rate: Number(i.rate ?? 0), active: i.active === 0 ? 0 : 1, created_at };
        const id = await d.monthly_clients.add(row);
        await enqueue("monthly_clients", "upsert", { id: sync_uuid, name: row.name, mobile: row.mobile, address: row.address, daily_quantity: row.daily_qty, rate_per_liter: row.rate, milk_type: row.milk_type, active: row.active === 1 });
        return { id, ...row };
      },
      async update(i: Partial<MonthlyClient> & { id: number }) {
        const cur = await d.monthly_clients.get(i.id);
        if (!cur) return { ok: false };
        const merged = { ...cur, ...i } as typeof cur;
        await d.monthly_clients.update(i.id, merged);
        await enqueue("monthly_clients", "upsert", { id: cur.sync_uuid, name: merged.name, mobile: merged.mobile, address: merged.address, daily_quantity: merged.daily_qty, rate_per_liter: merged.rate, milk_type: merged.milk_type, active: merged.active === 1, sync_version: 2 });
        return { ok: true };
      },
      async delete(id: number) {
        const c = await d.monthly_clients.get(id);
        await d.monthly_payments.where("client_id").equals(id).delete();
        await d.deliveries.where("client_id").equals(id).delete();
        await d.pauses.where("client_id").equals(id).delete();
        await d.monthly_clients.delete(id);
        if (c) await enqueue("monthly_clients", "upsert", { id: c.sync_uuid, deleted_at: nowIso(), sync_version: 2 });
        return { ok: true };
      },
      async deliveries(from?: string, to?: string, clientId?: number): Promise<CustomerDelivery[]> {
        const rows = await d.deliveries.toArray();
        return rows
          .filter(r => (!from || r.entry_date >= from) && (!to || r.entry_date <= to) && (!clientId || r.client_id === clientId))
          .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.id! - a.id!))
          .map(r => ({ id: r.id!, client_id: r.client_id, entry_date: r.entry_date, default_qty: r.default_qty, delivered_qty: r.delivered_qty, rate: r.rate, amount: r.amount, milk_type: r.milk_type, status: r.status, note: r.note, created_at: r.created_at }));
      },
      async deliveriesForDate(date: string): Promise<CustomerDelivery[]> {
        const rows = await d.deliveries.where("entry_date").equals(date).toArray();
        return rows.map(r => ({ id: r.id!, client_id: r.client_id, entry_date: r.entry_date, default_qty: r.default_qty, delivered_qty: r.delivered_qty, rate: r.rate, amount: r.amount, milk_type: r.milk_type, status: r.status, note: r.note, created_at: r.created_at }));
      },
      async saveDeliveries(date: string, rows: Array<{ client_id: number; default_qty: number; delivered_qty: number; rate: number; amount: number; milk_type?: string; status?: "delivered" | "skipped"; note?: string }>) {
        let count = 0;
        for (const r of rows) {
          const parent = await d.monthly_clients.get(r.client_id);
          if (!parent) continue;
          const existing = await d.deliveries.where("[client_id+entry_date]").equals([r.client_id, date]).first();
          const sync_uuid = existing?.sync_uuid ?? uuid();
          const created_at = nowIso();
          const patch = { sync_uuid, client_id: r.client_id, entry_date: date, default_qty: r.default_qty, delivered_qty: r.delivered_qty, rate: r.rate, amount: r.amount, milk_type: r.milk_type ?? null, status: r.status ?? ("delivered" as const), note: r.note ?? null, created_at };
          if (existing?.id) await d.deliveries.update(existing.id, patch); else await d.deliveries.add(patch);
          await enqueue("monthly_deliveries", "upsert", { id: sync_uuid, monthly_client_id: parent.sync_uuid, delivery_date: date, quantity: r.delivered_qty, rate: r.rate, status: r.status ?? "delivered", sync_version: existing ? 2 : 1 });
          count++;
        }
        return { ok: true, count };
      },
      async deleteDelivery(id: number) {
        const r = await d.deliveries.get(id);
        await d.deliveries.delete(id);
        if (r) await enqueue("monthly_deliveries", "upsert", { id: r.sync_uuid, deleted_at: nowIso(), sync_version: 2 });
        return { ok: true };
      },
      async pauses(clientId: number): Promise<DeliveryPause[]> {
        const rows = await d.pauses.where("client_id").equals(clientId).toArray();
        return rows.sort((a, b) => b.start_date.localeCompare(a.start_date))
          .map(r => ({ id: r.id!, client_id: r.client_id, start_date: r.start_date, end_date: r.end_date, reason: r.reason, created_at: r.created_at }));
      },
      async addPause(i: { clientId: number; start_date: string; end_date: string; reason?: string }): Promise<DeliveryPause> {
        const parent = await d.monthly_clients.get(i.clientId);
        if (!parent) throw new Error("Client not found");
        const sync_uuid = uuid();
        const created_at = nowIso();
        const id = await d.pauses.add({ sync_uuid, client_id: i.clientId, start_date: i.start_date, end_date: i.end_date, reason: i.reason ?? null, created_at });
        await enqueue("delivery_pauses", "upsert", { id: sync_uuid, monthly_client_id: parent.sync_uuid, from_date: i.start_date, to_date: i.end_date, reason: i.reason ?? null });
        return { id, client_id: i.clientId, start_date: i.start_date, end_date: i.end_date, reason: i.reason ?? null, created_at };
      },
      async deletePause(id: number) {
        const r = await d.pauses.get(id);
        await d.pauses.delete(id);
        if (r) await enqueue("delivery_pauses", "upsert", { id: r.sync_uuid, deleted_at: nowIso(), sync_version: 2 });
        return { ok: true };
      },
      async payments(clientId: number): Promise<MonthlyPayment[]> {
        const rows = await d.monthly_payments.where("client_id").equals(clientId).toArray();
        return rows.sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.id! - a.id!))
          .map(r => ({ id: r.id!, client_id: r.client_id, period: r.period, amount: r.amount, note: r.note, entry_date: r.entry_date, created_at: r.created_at }));
      },
      async addPayment(i: { clientId: number; amount: number; period?: string; note?: string; entry_date?: string }): Promise<MonthlyPayment> {
        const parent = await d.monthly_clients.get(i.clientId);
        if (!parent) throw new Error("Client not found");
        const dte = i.entry_date ?? today();
        const period = i.period ?? dte.slice(0, 7);
        const sync_uuid = uuid();
        const created_at = nowIso();
        const id = await d.monthly_payments.add({ sync_uuid, client_id: i.clientId, period, amount: Number(i.amount), note: i.note ?? null, entry_date: dte, created_at });
        await enqueue("monthly_payments", "upsert", { id: sync_uuid, monthly_client_id: parent.sync_uuid, amount: Number(i.amount), period, payment_date: dte, note: i.note ?? null });
        return { id, client_id: i.clientId, period, amount: Number(i.amount), note: i.note ?? null, entry_date: dte, created_at };
      },
      async deletePayment(id: number) {
        const r = await d.monthly_payments.get(id);
        await d.monthly_payments.delete(id);
        if (r) await enqueue("monthly_payments", "upsert", { id: r.sync_uuid, deleted_at: nowIso(), sync_version: 2 });
        return { ok: true };
      },
      async totals(from: string, to: string) {
        const [deliv, pays] = await Promise.all([d.deliveries.toArray(), d.monthly_payments.toArray()]);
        const charges = deliv.filter(x => x.entry_date >= from && x.entry_date <= to).reduce((a, x) => a + x.amount, 0);
        const paid = pays.filter(p => p.entry_date >= from && p.entry_date <= to).reduce((a, p) => a + p.amount, 0);
        const allCharges = deliv.reduce((a, x) => a + x.amount, 0);
        const allPaid = pays.reduce((a, p) => a + p.amount, 0);
        return { charges, paid, outstanding: allCharges - allPaid };
      },
    },

    purchases: {
      // v1 purchase suppliers stay local-only (they duplicate the v2 supplierLedger
      // shape which is what actually maps to the cloud `suppliers` table).
      async suppliers(): Promise<Supplier[]> {
        const [sups, entries] = await Promise.all([d.purchase_suppliers.toArray(), d.purchase_entries.toArray()]);
        return sups.map(s => ({
          id: s.id!, name: s.name, mobile: s.mobile, address: s.address, created_at: s.created_at,
          balance: entries.filter(e => e.supplier_id === s.id).reduce((a, e) => a + (e.type === "purchase" ? e.amount : -e.amount), 0),
        }));
      },
      async supplier(id: number) { const s = await d.purchase_suppliers.get(id); return s ? { id: s.id!, name: s.name, mobile: s.mobile, address: s.address, created_at: s.created_at, balance: 0 } : null; },
      async addSupplier(i: { name: string; mobile?: string; address?: string }): Promise<Supplier> {
        const created_at = nowIso();
        const id = await d.purchase_suppliers.add({ name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at });
        return { id, name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, created_at, balance: 0 };
      },
      async deleteSupplier(id: number) {
        await d.purchase_entries.where("supplier_id").equals(id).delete();
        await d.purchase_suppliers.delete(id);
        return { ok: true };
      },
      async supplierEntries(supplierId: number): Promise<PurchaseEntry[]> {
        const rows = await d.purchase_entries.where("supplier_id").equals(supplierId).toArray();
        return rows.sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.id! - a.id!))
          .map(r => ({ id: r.id!, entry_date: r.entry_date, category_id: r.category_id, supplier_id: r.supplier_id, item_name: r.item_name, qty: r.qty, unit: r.unit, rate: r.rate, amount: r.amount, paid_now: r.paid_now, type: r.type, note: r.note }));
      },
      async categories(): Promise<PurchaseCategory[]> {
        const rows = await d.purchase_categories.toArray();
        return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
          .map(c => ({ id: c.id!, name: c.name, kind: c.kind, is_custom: c.is_custom }));
      },
      async addCategory(i: { name: string; kind: "item" | "expense" }): Promise<PurchaseCategory> {
        const sync_uuid = uuid();
        const id = await d.purchase_categories.add({ sync_uuid, name: i.name, kind: i.kind, is_custom: 1 });
        await enqueue("purchase_categories", "upsert", { id: sync_uuid, name: i.name, kind: i.kind });
        return { id, name: i.name, kind: i.kind, is_custom: 1 };
      },
      async deleteCategory(id: number) {
        const c = await d.purchase_categories.get(id);
        if (c?.is_custom) {
          await d.purchase_categories.delete(id);
          await enqueue("purchase_categories", "upsert", { id: c.sync_uuid, deleted_at: nowIso(), sync_version: 2 });
        }
        return { ok: true };
      },
      async entries(f: { from?: string; to?: string; categoryId?: number; kind?: "item" | "expense"; q?: string } = {}): Promise<PurchaseEntry[]> {
        const [entries, cats, sups] = await Promise.all([d.purchase_entries.toArray(), d.purchase_categories.toArray(), d.purchase_suppliers.toArray()]);
        const ql = f.q?.toLowerCase();
        return entries.filter(e => {
          const cat = cats.find(c => c.id === e.category_id);
          if (f.from && e.entry_date < f.from) return false;
          if (f.to && e.entry_date > f.to) return false;
          if (f.categoryId && e.category_id !== f.categoryId) return false;
          if (f.kind && cat?.kind !== f.kind) return false;
          if (ql) {
            const sup = sups.find(x => x.id === e.supplier_id);
            const hay = `${e.item_name || ""} ${e.note || ""} ${sup?.name || ""}`.toLowerCase();
            if (!hay.includes(ql)) return false;
          }
          return true;
        }).map(e => {
          const cat = cats.find(c => c.id === e.category_id);
          const sup = sups.find(x => x.id === e.supplier_id);
          return { id: e.id!, entry_date: e.entry_date, category_id: e.category_id, supplier_id: e.supplier_id, item_name: e.item_name, qty: e.qty, unit: e.unit, rate: e.rate, amount: e.amount, paid_now: e.paid_now, type: e.type, note: e.note, category_name: cat?.name ?? null, category_kind: cat?.kind ?? null, supplier_name: sup?.name ?? null };
        }).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.id - a.id));
      },
      async addEntry(p: { entry_date?: string; categoryId?: number | null; supplierId?: number | null; itemName?: string; qty?: number; unit?: string; rate?: number; amount?: number; paidNow?: number; type?: "purchase" | "payment"; note?: string }) {
        const dte = p.entry_date ?? today();
        const amount = p.amount != null ? Number(p.amount) : (Number(p.qty) || 0) * (Number(p.rate) || 0);
        await d.purchase_entries.add({ entry_date: dte, category_id: p.categoryId ?? null, supplier_id: p.supplierId ?? null, item_name: p.itemName ?? null, qty: p.qty != null ? Number(p.qty) : null, unit: p.unit ?? null, rate: p.rate != null ? Number(p.rate) : null, amount, paid_now: Number(p.paidNow) || 0, type: p.type ?? "purchase", note: p.note ?? null });
        if ((p.type ?? "purchase") === "purchase" && Number(p.paidNow) > 0 && p.supplierId) {
          await d.purchase_entries.add({ entry_date: dte, category_id: null, supplier_id: p.supplierId, item_name: null, qty: null, unit: null, rate: null, amount: Number(p.paidNow), paid_now: 0, type: "payment", note: "Paid with purchase" });
        }
        return { ok: true };
      },
      async deleteEntry(id: number) { await d.purchase_entries.delete(id); return { ok: true }; },
      async totals(args: { from?: string; to?: string } = {}): Promise<PurchaseTotals> {
        const [entries, cats] = await Promise.all([d.purchase_entries.toArray(), d.purchase_categories.toArray()]);
        const td = today(); const m = td.slice(0, 7);
        const items = entries.filter(e => e.type === "purchase").map(e => ({ e, cat: cats.find(c => c.id === e.category_id) }));
        const isItem = (c: typeof cats[number] | undefined) => !c || c.kind === "item";
        const isExp = (c: typeof cats[number] | undefined) => c?.kind === "expense";
        return {
          today: items.filter(x => x.e.entry_date === td && isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0),
          month: items.filter(x => x.e.entry_date.startsWith(m) && isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0),
          all: items.filter(x => isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0),
          range_items: args.from && args.to ? items.filter(x => x.e.entry_date >= args.from! && x.e.entry_date <= args.to! && isItem(x.cat)).reduce((a, x) => a + x.e.amount, 0) : 0,
          range_expenses: args.from && args.to ? items.filter(x => x.e.entry_date >= args.from! && x.e.entry_date <= args.to! && isExp(x.cat)).reduce((a, x) => a + x.e.amount, 0) : 0,
        };
      },
      async expensesByCategory(from: string, to: string) {
        const [entries, cats] = await Promise.all([d.purchase_entries.toArray(), d.purchase_categories.toArray()]);
        return cats.filter(c => c.kind === "expense").map(c => ({
          name: c.name,
          total: entries.filter(e => e.type === "purchase" && e.category_id === c.id && e.entry_date >= from && e.entry_date <= to).reduce((a, e) => a + e.amount, 0),
        }));
      },
    },

    supplierLedger: (() => {
      const outstanding = async (id: string) => {
        const sup = await d.sl_suppliers.get(id); if (!sup) return 0;
        const [ps, pays] = await Promise.all([d.sl_purchases.where("supplier_id").equals(id).toArray(), d.sl_payments.where("supplier_id").equals(id).toArray()]);
        const p = ps.filter(x => x.payment_mode === "credit" && !x.deleted_at).reduce((a, x) => a + x.amount, 0);
        const pay = pays.filter(x => !x.deleted_at).reduce((a, x) => a + x.amount, 0);
        return (sup.opening_balance || 0) + p - pay;
      };
      return {
        async suppliers(q?: string): Promise<SupplierV2[]> {
          const rows = (await d.sl_suppliers.toArray()).filter(r => !r.deleted_at);
          const ql = (q || "").toLowerCase();
          const matched = ql ? rows.filter(r => (r.name + " " + (r.mobile || "") + " " + (r.address || "")).toLowerCase().includes(ql)) : rows;
          const out: SupplierV2[] = [];
          for (const r of matched) out.push({ ...r, created_by: null, updated_by: null, outstanding: await outstanding(r.id) });
          return out;
        },
        async supplier(id: string): Promise<SupplierV2 | null> {
          const r = await d.sl_suppliers.get(id);
          if (!r || r.deleted_at) return null;
          return { ...r, created_by: null, updated_by: null, outstanding: await outstanding(id) };
        },
        async addSupplier(i: { name: string; mobile?: string; address?: string; opening_balance?: number; notes?: string }): Promise<SupplierV2> {
          const id = uuid();
          const now = nowIso();
          const row = { id, name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, opening_balance: Number(i.opening_balance) || 0, notes: i.notes ?? null, deleted_at: null, created_at: now, updated_at: now };
          await d.sl_suppliers.add(row);
          await enqueue("suppliers", "upsert", { id, name: row.name, mobile: row.mobile, address: row.address, opening_balance: row.opening_balance, notes: row.notes });
          return { ...row, created_by: null, updated_by: null };
        },
        async updateSupplier(i: { id: string; name: string; mobile?: string; address?: string; opening_balance?: number; notes?: string }) {
          const r = await d.sl_suppliers.get(i.id);
          if (!r) return { ok: false };
          const patch = { name: i.name, mobile: i.mobile ?? null, address: i.address ?? null, opening_balance: Number(i.opening_balance) || 0, notes: i.notes ?? null, updated_at: nowIso() };
          await d.sl_suppliers.update(i.id, patch);
          await enqueue("suppliers", "upsert", { id: i.id, ...patch, sync_version: 2 });
          return { ok: true };
        },
        async deleteSupplier(id: string) {
          const del = nowIso();
          await d.sl_suppliers.update(id, { deleted_at: del });
          await enqueue("suppliers", "upsert", { id, deleted_at: del, sync_version: 2 });
          return { ok: true };
        },
        async ledger({ supplierId, from, to, q }: { supplierId: string; from?: string; to?: string; q?: string }): Promise<SupplierLedger> {
          const [sup, allP, allPay] = await Promise.all([d.sl_suppliers.get(supplierId), d.sl_purchases.where("supplier_id").equals(supplierId).toArray(), d.sl_payments.where("supplier_id").equals(supplierId).toArray()]);
          const fromD = from || "0000-01-01", toD = to || "9999-12-31"; const ql = (q || "").toLowerCase();
          const priorP = allP.filter(x => x.payment_mode === "credit" && !x.deleted_at && x.entry_date < fromD).reduce((a, x) => a + x.amount, 0);
          const priorPay = allPay.filter(x => !x.deleted_at && x.entry_date < fromD).reduce((a, x) => a + x.amount, 0);
          let bal = (sup?.opening_balance || 0) + priorP - priorPay;
          const opening = bal;
          const purchases = allP.filter(x => !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).map(x => ({ ...x, kind: "purchase" as const }));
          const payments = allPay.filter(x => !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).map(x => ({ ...x, kind: "payment" as const }));
          let entries: Array<(typeof purchases[number] | typeof payments[number])> = [...purchases, ...payments];
          if (ql) entries = entries.filter(e => `${("item_name" in e && e.item_name) || ""} ${("invoice_no" in e && e.invoice_no) || ""} ${("reference_no" in e && e.reference_no) || ""} ${e.notes || ""} ${("mode" in e && e.mode) || ""}`.toLowerCase().includes(ql));
          entries.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id.localeCompare(b.id));
          const rows: SupplierLedgerRow[] = entries.map(e => {
            if (e.kind === "purchase") { const debit = e.payment_mode === "credit" ? e.amount : 0; bal += debit; return { id: e.id, entry_date: e.entry_date, kind: "purchase", debit, credit: 0, balance: bal, invoice_no: e.invoice_no, item_name: e.item_name, qty: e.qty, unit: e.unit, rate: e.rate, amount: e.amount, payment_mode: e.payment_mode, notes: e.notes }; }
            bal -= e.amount; return { id: e.id, entry_date: e.entry_date, kind: "payment", debit: 0, credit: e.amount, balance: bal, amount: e.amount, mode: e.mode, reference_no: e.reference_no, notes: e.notes };
          });
          return { opening, rows, closing: bal };
        },
        async addPurchase(i: { supplier_id: string; entry_date?: string; invoice_no?: string; item_name?: string; qty?: number; unit?: string; rate?: number; amount?: number; payment_mode?: "cash" | "credit"; notes?: string }) {
          const id = uuid(); const now = nowIso();
          const amount = i.amount != null ? Number(i.amount) : (Number(i.qty) || 0) * (Number(i.rate) || 0);
          const row = { id, supplier_id: i.supplier_id, entry_date: i.entry_date || today(), invoice_no: i.invoice_no ?? null, item_name: i.item_name ?? null, qty: i.qty ?? null, unit: i.unit ?? null, rate: i.rate ?? null, amount, payment_mode: (i.payment_mode || "credit") as "cash" | "credit", notes: i.notes ?? null, deleted_at: null, created_at: now, updated_at: now };
          await d.sl_purchases.add(row);
          await enqueue("purchases", "upsert", { id, supplier_id: i.supplier_id, purchase_date: row.entry_date, qty: row.qty, unit: row.unit, rate: row.rate, amount, payment_mode: row.payment_mode, invoice_no: row.invoice_no, notes: row.notes });
          return { ok: true, id };
        },
        async addPayment(i: { supplier_id: string; entry_date?: string; amount: number; mode?: "cash" | "bank" | "upi" | "cheque" | "other"; reference_no?: string; notes?: string }) {
          const id = uuid(); const now = nowIso();
          const row = { id, supplier_id: i.supplier_id, entry_date: i.entry_date || today(), amount: Number(i.amount), mode: i.mode || "cash", reference_no: i.reference_no ?? null, notes: i.notes ?? null, deleted_at: null, created_at: now, updated_at: now };
          await d.sl_payments.add(row);
          await enqueue("supplier_payments", "upsert", { id, supplier_id: i.supplier_id, payment_date: row.entry_date, amount: row.amount, mode: row.mode, reference_no: row.reference_no, notes: row.notes });
          return { ok: true, id };
        },
        async deletePurchase(id: string) {
          const del = nowIso();
          await d.sl_purchases.update(id, { deleted_at: del });
          await enqueue("purchases", "upsert", { id, deleted_at: del, sync_version: 2 });
          return { ok: true };
        },
        async deletePayment(id: string) {
          const del = nowIso();
          await d.sl_payments.update(id, { deleted_at: del });
          await enqueue("supplier_payments", "upsert", { id, deleted_at: del, sync_version: 2 });
          return { ok: true };
        },
        async totals(args: { from?: string; to?: string } = {}) {
          const [ps, pays, sups] = await Promise.all([d.sl_purchases.toArray(), d.sl_payments.toArray(), d.sl_suppliers.toArray()]);
          const fromD = args.from || "0000-01-01", toD = args.to || "9999-12-31";
          const purchases = ps.filter(x => !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).reduce((a, x) => a + x.amount, 0);
          const payments = pays.filter(x => !x.deleted_at && x.entry_date >= fromD && x.entry_date <= toD).reduce((a, x) => a + x.amount, 0);
          let out = 0; for (const s of sups.filter(x => !x.deleted_at)) out += await outstanding(s.id);
          return { purchases, payments, outstanding: out };
        },
      };
    })(),

    ghee: {
      async addPurchase(i: { qty_kg: number; entry_date?: string; note?: string }) {
        const qty = Number(i.qty_kg);
        if (!qty || qty <= 0) throw new Error("Enter a valid quantity in KG");
        const row = { sync_uuid: uuid(), entry_date: i.entry_date || today(), qty_kg: qty, note: i.note ?? null, created_at: nowIso() };
        const id = await d.ghee_purchases.add(row);
        return { ...row, id };
      },
      async addSale(i: { qty_kg: number; amount: number; mode?: "amount" | "weight"; entry_date?: string; note?: string }) {
        const qty = Number(i.qty_kg), amount = Number(i.amount);
        if (!qty || qty <= 0) throw new Error("Enter a valid quantity in KG");
        if (!amount || amount <= 0) throw new Error("Enter a valid amount");
        const st = await this.stock();
        if (qty > st.remaining_kg + 1e-9) throw new Error(`Only ${st.remaining_kg.toFixed(3)} KG in stock`);
        const row = { sync_uuid: uuid(), entry_date: i.entry_date || today(), qty_kg: qty, amount, mode: (i.mode || "weight") as "amount" | "weight", note: i.note ?? null, created_at: nowIso() };
        const id = await d.ghee_sales.add(row);
        return { ...row, id };
      },
      async stock() {
        const [ps, ss] = await Promise.all([d.ghee_purchases.toArray(), d.ghee_sales.toArray()]);
        const purchased_kg = ps.reduce((a, x) => a + x.qty_kg, 0);
        const sold_kg = ss.reduce((a, x) => a + x.qty_kg, 0);
        const sales_amount = ss.reduce((a, x) => a + x.amount, 0);
        return { purchased_kg, sold_kg, remaining_kg: purchased_kg - sold_kg, sales_amount };
      },
      async purchases(limit = 200) {
        const rows = await d.ghee_purchases.toArray();
        return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
      },
      async sales(limit = 200) {
        const rows = await d.ghee_sales.toArray();
        return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
      },
      async deletePurchase(id: number) { await d.ghee_purchases.delete(id); return { ok: true }; },
      async deleteSale(id: number) { await d.ghee_sales.delete(id); return { ok: true }; },
      async report(args: { from?: string; to?: string } = {}) {
        const from = args.from || "0000-01-01", to = args.to || "9999-12-31";
        const [ps, ss] = await Promise.all([d.ghee_purchases.toArray(), d.ghee_sales.toArray()]);
        const pIn = ps.filter(x => x.entry_date >= from && x.entry_date <= to);
        const sIn = ss.filter(x => x.entry_date >= from && x.entry_date <= to);
        const byDayMap = new Map<string, { day: string; qty_kg: number; amount: number }>();
        for (const s of sIn) {
          const cur = byDayMap.get(s.entry_date) || { day: s.entry_date, qty_kg: 0, amount: 0 };
          cur.qty_kg += s.qty_kg; cur.amount += s.amount; byDayMap.set(s.entry_date, cur);
        }
        const purchaseDayMap = new Map<string, { day: string; qty_kg: number }>();
        for (const p of pIn) {
          const cur = purchaseDayMap.get(p.entry_date) || { day: p.entry_date, qty_kg: 0 };
          cur.qty_kg += p.qty_kg; purchaseDayMap.set(p.entry_date, cur);
        }
        const weekKey = (iso: string) => { const dt = new Date(iso + "T00:00:00"); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return dt.toISOString().slice(0, 10); };
        const bucket = (keyFn: (iso: string) => string) => {
          const m = new Map<string, { key: string; qty_kg: number; amount: number }>();
          for (const s of sIn) { const k = keyFn(s.entry_date); const c = m.get(k) || { key: k, qty_kg: 0, amount: 0 }; c.qty_kg += s.qty_kg; c.amount += s.amount; m.set(k, c); }
          return [...m.values()].sort((a, b) => b.key.localeCompare(a.key));
        };
        return {
          purchased_kg: pIn.reduce((a, x) => a + x.qty_kg, 0),
          sold_kg: sIn.reduce((a, x) => a + x.qty_kg, 0),
          sales_amount: sIn.reduce((a, x) => a + x.amount, 0),
          remaining_kg: ps.reduce((a, x) => a + x.qty_kg, 0) - ss.reduce((a, x) => a + x.qty_kg, 0),
          sales_by_date: [...byDayMap.values()].sort((a, b) => b.day.localeCompare(a.day)),
          purchases_by_date: [...purchaseDayMap.values()].sort((a, b) => b.day.localeCompare(a.day)),
          daily: bucket(iso => iso),
          weekly: bucket(weekKey),
          monthly: bucket(iso => iso.slice(0, 7)),
        };
      },
    },

    print: {
      async receipt(p: { invoice_no: number | string; amount: number; date: string; shop_name: string; logo_data_url?: string }) {
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>
          @page{size:80mm auto;margin:0}
          html,body{margin:0!important;padding:0!important}
          body{width:80mm;font-family:'Courier New',monospace;color:#000;padding:0 3mm 3mm;text-align:center}
          .logo{max-height:16mm;max-width:55%;object-fit:contain;display:block;margin:0 auto 1mm}
          .inv{display:flex;justify-content:space-between;align-items:baseline;text-align:left;font-size:9pt;font-weight:700;margin-bottom:2mm}
          .inv span:last-child{font-weight:400}
          .amt-box{border:2px solid #000;border-radius:2mm;padding:3mm 2mm;margin:1mm 0}
          .amt{font-size:24pt;font-weight:900;letter-spacing:1px;line-height:1}
          .foot{margin-top:3mm;font-size:8pt;font-style:italic;border-top:1px dashed #000;padding-top:2mm}
        </style></head><body>
          ${p.logo_data_url ? `<img class="logo" src="${p.logo_data_url}"/>` : ""}
          <div class="inv"><span>Invoice #${p.invoice_no}</span><span>${p.date}</span></div>
          <div class="amt-box"><div class="amt">Rs. ${Number(p.amount).toLocaleString()}</div></div>
          <div class="foot">Designed &amp; developed by Zubair Khan</div>
        </body></html>`;
        return printViaIframe(html);
      },
      async gheeReceipt(p: { invoice_no: number | string; qty_kg: number; amount: number; date: string; shop_name: string; logo_data_url?: string }) {
        const kgLabel = `${Number(p.qty_kg || 0).toFixed(3).replace(/\.?0+$/, "")} KG`;
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>
          @page{size:80mm auto;margin:0}
          html,body{margin:0;padding:0}
          body{width:80mm;font-family:'Courier New',monospace;color:#000;padding:0 6mm 6mm;text-align:center}
          .logo{max-height:28mm;max-width:90%;object-fit:contain;display:block;margin:0 auto 3mm}
          .inv{text-align:left;font-size:10pt;font-weight:700;margin-bottom:3mm}
          .item{font-size:12pt;font-weight:700;margin:2mm 0}
          .amt-box{border:2px solid #000;border-radius:2mm;padding:4mm 3mm;margin:2mm 0}
          .amt{font-size:26pt;font-weight:900;letter-spacing:1px;line-height:1}
          .foot{margin-top:5mm;font-size:8pt;font-style:italic;border-top:1px dashed #000;padding-top:2mm}
        </style></head><body>
          ${p.logo_data_url ? `<img class="logo" src="${p.logo_data_url}"/>` : ""}
          <div class="inv">Invoice #${p.invoice_no}<br/><span style="font-weight:400">${p.date}</span></div>
          <div class="item">Desi Ghee &mdash; ${kgLabel}</div>
          <div class="amt-box"><div class="amt">Rs. ${Number(p.amount).toLocaleString()}</div></div>
          <div class="foot">Designed &amp; developed by Zubair Khan</div>
        </body></html>`;
        return printViaIframe(html);
      },
      async test() { return printViaIframe(`<!doctype html><html><body style="font-family:sans-serif;padding:20px"><h1>Test Print</h1><p>${new Date().toLocaleString()}</p></body></html>`); },
      async html(html: string) { return printViaIframe(html); },
    },

    data: {
      async backup() {
        const dump: Record<string, unknown[]> = {};
        for (const t of db().tables) dump[t.name] = await t.toArray();
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `milkshop-backup-${today()}.json`; a.click();
        return { ok: true };
      },
      async restore() { return { ok: false, error: "Use Import in Settings (not yet wired)" as never }; },
      async clearAll(currentPassword: string) {
        // Verify current password before wiping.
        const s = await d.session.get("session");
        if (!s) return { ok: false, error: "Not logged in" };
        const u = await d.users.get(s.user_id);
        if (!u || !(await bcrypt.compare(currentPassword, u.password_hash))) return { ok: false, error: "Password wrong" };
        await Promise.all(db().tables.map(t => t.clear()));
        await ensureSeed();
        return { ok: true };
      },
    },
  };
}

// Cached instance. Route/component code should not create side effects at
// module scope, so building the api lazily also lets ensureSeed() run first.
let _api: ReturnType<typeof buildApi> | undefined;
export function api() {
  if (!_api) {
    _api = buildApi();
    // Kick seed & pairing awareness async; api methods use the same db handle.
    void ensureSeed();
  }
  return _api;
}

// Legacy compatibility export — always false in the PWA build. Kept only so
// that any stray reference does not break the build; the value is always
// `false` and callers should treat it as such.
export const isElectron = () => false;

// Re-exported for the sync engine.
export { getPairing };
