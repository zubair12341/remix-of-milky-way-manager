// IndexedDB (Dexie) schema — durable local source of truth for the PWA.
// The legacy stub used a single JSON blob in localStorage; this replaces that
// with per-entity tables so we can index, query lazily, and grow without
// hitting the 5 MB localStorage ceiling.
//
// Every row that syncs to Supabase carries a stable `sync_uuid` (generated
// on insert). Local integer PKs stay for UI compatibility; the outbox
// pushes rows to cloud tables keyed by `sync_uuid`.

import Dexie, { type Table } from "dexie";

export type LocalUser = { id?: number; username: string; password_hash: string };
export type LocalCash = { id?: number; sync_uuid: string; invoice_no: number; amount: number; created_at: string };
export type LocalUdharCustomer = { id?: number; sync_uuid: string; name: string; mobile: string | null; address: string | null; created_at: string };
export type LocalUdharEntry = { id?: number; sync_uuid: string; customer_id: number; type: "credit" | "payment"; amount: number; note: string | null; entry_date: string; created_at: string };
export type LocalMonthlyClient = {
  id?: number; sync_uuid: string; name: string; mobile: string | null; address: string | null;
  daily_qty: number; milk_type: string; rate: number; active: number; created_at: string;
};
export type LocalMonthlyPayment = { id?: number; sync_uuid: string; client_id: number; period: string; amount: number; note: string | null; entry_date: string; created_at: string };
export type LocalDelivery = { id?: number; sync_uuid: string; client_id: number; entry_date: string; default_qty: number; delivered_qty: number; rate: number; amount: number; milk_type: string | null; status: "delivered" | "skipped"; note: string | null; created_at: string };
export type LocalPause = { id?: number; sync_uuid: string; client_id: number; start_date: string; end_date: string; reason: string | null; created_at: string };
export type LocalPurchaseSupplier = { id?: number; name: string; mobile: string | null; address: string | null; created_at: string };
export type LocalPurchaseCategory = { id?: number; sync_uuid: string; name: string; kind: "item" | "expense"; is_custom: number };
export type LocalPurchaseEntry = { id?: number; entry_date: string; category_id: number | null; supplier_id: number | null; item_name: string | null; qty: number | null; unit: string | null; rate: number | null; amount: number; paid_now: number; type: "purchase" | "payment"; note: string | null };
export type LocalSLSupplier = { id: string; name: string; mobile: string | null; address: string | null; opening_balance: number; notes: string | null; deleted_at: string | null; created_at: string; updated_at: string };
export type LocalSLPurchase = { id: string; supplier_id: string; entry_date: string; invoice_no: string | null; item_name: string | null; qty: number | null; unit: string | null; rate: number | null; amount: number; payment_mode: "cash" | "credit"; notes: string | null; deleted_at: string | null; created_at: string; updated_at: string };
export type LocalSLPayment = { id: string; supplier_id: string; entry_date: string; amount: number; mode: string; reference_no: string | null; notes: string | null; deleted_at: string | null; created_at: string; updated_at: string };
// Desi Ghee inventory. Purchases only track KG; sales track amount + KG sold.
export type LocalGheePurchase = { id?: number; sync_uuid: string; entry_date: string; qty_kg: number; note: string | null; created_at: string };
export type LocalGheeSale = { id?: number; sync_uuid: string; entry_date: string; qty_kg: number; amount: number; mode: "amount" | "weight"; note: string | null; created_at: string };

// Cloud table names must match the whitelist inside the Supabase
// apply_changes RPC. Only rows targeted at these tables get pushed.
export type CloudTable =
  | "cash_sales"
  | "udhar_customers" | "udhar_entries"
  | "monthly_clients" | "monthly_deliveries" | "delivery_pauses" | "monthly_payments"
  | "suppliers" | "purchases" | "supplier_payments"
  | "purchase_categories";

export type OutboxRow = {
  id?: number;
  table: CloudTable;
  op: "upsert" | "delete";
  // Payload is the exact record the RPC will upsert. `business_id` is filled
  // by the sync engine at drain time using the current pairing, so it does
  // not need to be present when a mutation enqueues.
  payload: Record<string, unknown> & { id: string; sync_version: number };
  created_at: string;
  attempts: number;
  last_error: string | null;
};

export type SyncMetaRow = { key: string; value: string };
export type SessionRow = { key: "session"; user_id: number; username: string };

export class MilkShopDB extends Dexie {
  users!: Table<LocalUser, number>;
  cash!: Table<LocalCash, number>;
  udhar_customers!: Table<LocalUdharCustomer, number>;
  udhar_entries!: Table<LocalUdharEntry, number>;
  monthly_clients!: Table<LocalMonthlyClient, number>;
  monthly_payments!: Table<LocalMonthlyPayment, number>;
  deliveries!: Table<LocalDelivery, number>;
  pauses!: Table<LocalPause, number>;
  purchase_suppliers!: Table<LocalPurchaseSupplier, number>;
  purchase_categories!: Table<LocalPurchaseCategory, number>;
  purchase_entries!: Table<LocalPurchaseEntry, number>;
  sl_suppliers!: Table<LocalSLSupplier, string>;
  sl_purchases!: Table<LocalSLPurchase, string>;
  sl_payments!: Table<LocalSLPayment, string>;
  ghee_purchases!: Table<LocalGheePurchase, number>;
  ghee_sales!: Table<LocalGheeSale, number>;
  settings!: Table<{ key: string; value: string }, string>;
  session!: Table<SessionRow, string>;
  outbox!: Table<OutboxRow, number>;
  sync_meta!: Table<SyncMetaRow, string>;

  constructor() {
    super("milkshop_pwa_v1");
    this.version(1).stores({
      users: "++id, &username",
      cash: "++id, sync_uuid, created_at, invoice_no",
      udhar_customers: "++id, sync_uuid, name, created_at",
      udhar_entries: "++id, sync_uuid, customer_id, entry_date",
      monthly_clients: "++id, sync_uuid, name, active",
      monthly_payments: "++id, sync_uuid, client_id, entry_date, period",
      deliveries: "++id, sync_uuid, client_id, entry_date, [client_id+entry_date]",
      pauses: "++id, sync_uuid, client_id, start_date, end_date",
      purchase_suppliers: "++id, name, created_at",
      purchase_categories: "++id, sync_uuid, kind, name",
      purchase_entries: "++id, entry_date, category_id, supplier_id, type",
      sl_suppliers: "id, name, deleted_at, updated_at",
      sl_purchases: "id, supplier_id, entry_date, payment_mode, deleted_at, updated_at",
      sl_payments: "id, supplier_id, entry_date, deleted_at, updated_at",
      settings: "key",
      session: "key",
      outbox: "++id, created_at, table",
      sync_meta: "key",
    });
    // v2 — Desi Ghee inventory module (local-only, not part of the cloud
    // apply_changes whitelist yet).
    this.version(2).stores({
      ghee_purchases: "++id, sync_uuid, entry_date, created_at",
      ghee_sales: "++id, sync_uuid, entry_date, created_at",
    });
  }
}

let _db: MilkShopDB | undefined;
export function db(): MilkShopDB {
  if (!_db) _db = new MilkShopDB();
  return _db;
}

export function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Seed the default data set on first launch (categories only — everything
// else is user-generated).
export async function ensureSeed() {
  const d = db();
  const count = await d.purchase_categories.count();
  if (count === 0) {
    const defaults: LocalPurchaseCategory[] = [
      { sync_uuid: uuid(), name: "Milk Purchase", kind: "item", is_custom: 0 },
      { sync_uuid: uuid(), name: "Dairy Products", kind: "item", is_custom: 0 },
      { sync_uuid: uuid(), name: "Shop Supplies", kind: "item", is_custom: 0 },
      { sync_uuid: uuid(), name: "Miscellaneous", kind: "item", is_custom: 0 },
      { sync_uuid: uuid(), name: "Utilities", kind: "expense", is_custom: 0 },
      { sync_uuid: uuid(), name: "Transportation", kind: "expense", is_custom: 0 },
      { sync_uuid: uuid(), name: "Maintenance", kind: "expense", is_custom: 0 },
      { sync_uuid: uuid(), name: "Other Expense", kind: "expense", is_custom: 0 },
    ];
    await d.purchase_categories.bulkAdd(defaults);
  }
  const settingsCount = await d.settings.count();
  if (settingsCount === 0) {
    await d.settings.bulkPut([
      { key: "shop_name", value: "Milk Shop" },
      { key: "logo_data_url", value: "" },
      { key: "language", value: "en" },
      { key: "printer_name", value: "" },
      { key: "receipt_width", value: "80" },
      { key: "invoice_counter", value: "1000" },
      { key: "first_install_complete", value: "0" },
    ]);
  }
}
