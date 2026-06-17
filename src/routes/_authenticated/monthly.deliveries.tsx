import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api, type MonthlyClient, type CustomerDelivery } from "@/lib/db";
import { fmtMoney, todayISO, fmtDate } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { Save, Repeat, Printer } from "lucide-react";
import { wrapDocument, printDocument, loadShopMeta, escape as esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/monthly/deliveries")({ component: DailyDeliveries });

type Row = { client: MonthlyClient; delivered_qty: string; status: "delivered" | "skipped"; note: string };

function DailyDeliveries() {
  const { t } = useLang();
  const [date, setDate] = useState(todayISO());
  const { data: clients = [] } = useQuery({ queryKey: ["monthly"], queryFn: () => api().monthly.list() });
  const { data: existing = [] } = useQuery({ queryKey: ["deliveries-for", date], queryFn: () => api().monthly.deliveriesForDate(date) });
  const [rows, setRows] = useState<Record<number, Row>>({});

  const activeClients = useMemo(() => clients.filter(c => c.active), [clients]);

  useEffect(() => {
    const m: Record<number, Row> = {};
    for (const c of activeClients) {
      const ex = existing.find(e => e.client_id === c.id);
      m[c.id] = {
        client: c,
        delivered_qty: ex ? String(ex.delivered_qty) : String(c.daily_qty),
        status: ex?.status ?? (c.paused ? "skipped" : "delivered"),
        note: ex?.note ?? "",
      };
    }
    setRows(m);
  }, [activeClients, existing]);

  const setRow = (id: number, patch: Partial<Row>) => setRows(r => ({ ...r, [id]: { ...r[id], ...patch } }));

  const markAllDefault = () => {
    setRows(r => {
      const copy = { ...r };
      for (const id of Object.keys(copy)) {
        const row = copy[Number(id)];
        copy[Number(id)] = { ...row, delivered_qty: String(row.client.daily_qty), status: "delivered" };
      }
      return copy;
    });
  };

  const totalQty = Object.values(rows).reduce((a, r) => a + (r.status === "delivered" ? Number(r.delivered_qty) || 0 : 0), 0);
  const totalAmount = Object.values(rows).reduce((a, r) => a + (r.status === "delivered" ? (Number(r.delivered_qty) || 0) * r.client.rate : 0), 0);

  const save = async () => {
    const payload = Object.values(rows).map(r => {
      const qty = r.status === "skipped" ? 0 : Number(r.delivered_qty) || 0;
      return { client_id: r.client.id, default_qty: r.client.daily_qty, delivered_qty: qty, rate: r.client.rate, amount: qty * r.client.rate, milk_type: r.client.milk_type, status: r.status, note: r.note };
    });
    await api().monthly.saveDeliveries(date, payload);
    toast.success(`${t("saved")} (${payload.length})`);
  };

  const printSheet = async () => {
    const meta = await loadShopMeta();
    const rowsHtml = Object.values(rows).map(r => `
      <tr>
        <td>${esc(r.client.name)}</td>
        <td>${esc(r.client.mobile || "—")}</td>
        <td class="num">${r.client.daily_qty}L</td>
        <td class="num">${r.status === "skipped" ? "—" : (Number(r.delivered_qty) || 0) + "L"}</td>
        <td>${esc(r.status === "skipped" ? t("skipped") : t("delivered"))}</td>
        <td class="num">${esc(fmtMoney(r.status === "delivered" ? (Number(r.delivered_qty) || 0) * r.client.rate : 0))}</td>
      </tr>`).join("");
    const body = `
      <table>
        <thead><tr><th>${t("name")}</th><th>${t("mobile")}</th><th class="num">${t("defaultQty")}</th><th class="num">${t("actualQty")}</th><th>${t("status")}</th><th class="num">${t("amount")}</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="3"></td><td class="num">${totalQty.toFixed(2)}L</td><td></td><td class="num">${esc(fmtMoney(totalAmount))}</td></tr></tfoot>
      </table>`;
    await printDocument(wrapDocument({ ...meta, title: t("deliverySheet"), subtitle: fmtDate(date) }, body));
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-black">{t("dailyDeliveries")}</h1>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-44" />
          <Button onClick={markAllDefault} variant="outline" className="h-11"><Repeat className="w-4 h-4 mr-1"/>{t("markAllDefault")}</Button>
          <Button onClick={printSheet} variant="outline" className="h-11"><Printer className="w-4 h-4 mr-1"/>{t("printDeliverySheet")}</Button>
          <Button onClick={save} className="h-11 font-bold"><Save className="w-4 h-4 mr-1"/>{t("saveAll")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("delivered")}</p><p className="text-2xl font-black tabular-nums">{totalQty.toFixed(2)} L</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("amount")}</p><p className="text-2xl font-black tabular-nums text-primary">{fmtMoney(totalAmount)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("active")}</p><p className="text-2xl font-black tabular-nums">{activeClients.length}</p></Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted text-xs font-bold uppercase">
          <div className="col-span-3">{t("name")}</div>
          <div className="col-span-1 text-right">{t("defaultQty")}</div>
          <div className="col-span-2">{t("actualQty")}</div>
          <div className="col-span-2">{t("status")}</div>
          <div className="col-span-2 text-right">{t("amount")}</div>
          <div className="col-span-2">{t("notes")}</div>
        </div>
        {activeClients.length === 0 && <p className="p-8 text-center text-muted-foreground">{t("noData")}</p>}
        {activeClients.map(c => {
          const r = rows[c.id]; if (!r) return null;
          const amt = r.status === "delivered" ? (Number(r.delivered_qty) || 0) * c.rate : 0;
          return (
            <div key={c.id} className={`grid grid-cols-12 gap-2 px-4 py-2 border-t items-center ${c.paused ? "bg-warning/5" : ""}`}>
              <div className="col-span-3">
                <p className="font-bold">{c.name}{c.paused ? <span className="ml-2 text-xs text-warning">({t("paused")} → {c.pause_end})</span> : null}</p>
                <p className="text-xs text-muted-foreground">{c.mobile || ""} • {t(c.milk_type as any)} @ {fmtMoney(c.rate)}/L</p>
              </div>
              <div className="col-span-1 text-right text-sm font-bold tabular-nums">{c.daily_qty}L</div>
              <div className="col-span-2"><Input type="number" inputMode="decimal" value={r.delivered_qty} onChange={(e) => setRow(c.id, { delivered_qty: e.target.value, status: "delivered" })} className="h-9" disabled={r.status === "skipped"} /></div>
              <div className="col-span-2">
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={r.status} onChange={(e) => setRow(c.id, { status: e.target.value as any })}>
                  <option value="delivered">{t("delivered")}</option><option value="skipped">{t("skipped")}</option>
                </select>
              </div>
              <div className="col-span-2 text-right font-bold tabular-nums">{fmtMoney(amt)}</div>
              <div className="col-span-2"><Input value={r.note} onChange={(e) => setRow(c.id, { note: e.target.value })} placeholder="—" className="h-9" /></div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
