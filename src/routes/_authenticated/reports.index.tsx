import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Printer, FileBarChart } from "lucide-react";
import { wrapDocument, printDocument, loadShopMeta, escape as esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/reports/")({ component: Reports });

function presetRange(p: string): { from: string; to: string } {
  const t = new Date(); const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(t);
  if (p === "today") return { from: today, to: today };
  if (p === "yesterday") { const y = new Date(t); y.setDate(t.getDate() - 1); return { from: fmt(y), to: fmt(y) }; }
  if (p === "week") { const w = new Date(t); w.setDate(t.getDate() - 6); return { from: fmt(w), to: today }; }
  if (p === "month") return { from: today.slice(0, 8) + "01", to: today };
  return { from: today.slice(0, 8) + "01", to: today };
}

function Reports() {
  const { t } = useLang();
  const [preset, setPreset] = useState<string>("month");
  const [{ from, to }, setRange] = useState(presetRange("month"));
  const setPresetRange = (p: string) => { setPreset(p); setRange(presetRange(p)); };

  const { data: cashRange = [] } = useQuery({ queryKey: ["cash-range", from, to], queryFn: () => api().cash.range(from, to) });
  const { data: cashSum } = useQuery({ queryKey: ["cash-sum", from, to], queryFn: () => api().cash.sum(from, to) });
  const { data: recentSales = [] } = useQuery({ queryKey: ["cash-recent-100"], queryFn: () => api().cash.recent(100) });
  const { data: purchaseTotals } = useQuery({ queryKey: ["purchase-totals", from, to], queryFn: () => api().purchases.totals({ from, to }) });

  // fill missing days for chart
  const days: { day: string; total: number }[] = [];
  const start = new Date(from), end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const hit = cashRange.find(r => r.day === k);
    days.push({ day: k.slice(5), total: hit?.total ?? 0 });
  }

  const exportCsv = () => {
    const rows = [["Invoice", "Amount", "Date"], ...recentSales.map(s => [s.invoice_no, s.amount, s.created_at])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cash-sales-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = async () => {
    const meta = await loadShopMeta();
    const filtered = recentSales.filter(s => { const d = s.created_at.slice(0, 10); return d >= from && d <= to; });
    const rowsHtml = filtered.map(s => `<tr><td>${esc(fmtDate(s.created_at))}</td><td>#${s.invoice_no}</td><td class="num">${esc(fmtMoney(s.amount))}</td></tr>`).join("");
    const total = filtered.reduce((a, s) => a + s.amount, 0);
    const body = `
      <div class="totals">
        <div class="box"><div class="l">${t("totalSales")}</div><div class="v">${esc(fmtMoney(total))}</div></div>
        <div class="box"><div class="l">${t("recentSales")}</div><div class="v">${filtered.length}</div></div>
      </div>
      <table style="margin-top:14px"><thead><tr><th>${t("date")}</th><th>${t("lastInvoice")}</th><th class="num">${t("amount")}</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="3" style="text-align:center;color:#666;padding:20px">${t("noData")}</td></tr>`}</tbody>
      <tfoot><tr><td colspan="2">${t("total")}</td><td class="num">${esc(fmtMoney(total))}</td></tr></tfoot></table>`;
    await printDocument(wrapDocument({ ...meta, title: t("salesReport"), subtitle: `${fmtDate(from)} → ${fmtDate(to)}` }, body));
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("reports")}</h1>
        <div className="flex gap-2">
          <Link to="/reports/summary"><Button variant="outline" className="h-11"><FileBarChart className="w-4 h-4 mr-1"/>{t("summaryReport")}</Button></Link>
          <Button onClick={exportCsv} variant="outline" className="h-11">{t("exportCsv")}</Button>
          <Button onClick={printReport} className="h-11 font-bold"><Printer className="w-4 h-4 mr-1"/>{t("printReport")}</Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[["today", t("today")], ["yesterday", t("yesterday")], ["week", t("thisWeek")], ["month", t("thisMonth")], ["custom", t("customRange")]].map(([k, l]) => (
            <button key={k} className={`h-10 px-3 rounded-md text-sm font-bold border ${preset === k ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`} onClick={() => setPresetRange(k)}>{l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-2 items-end">
            <div><Label>{t("fromDate")}</Label><Input type="date" value={from} onChange={(e) => setRange(r => ({ ...r, from: e.target.value }))} className="h-10 w-44" /></div>
            <div><Label>{t("toDate")}</Label><Input type="date" value={to} onChange={(e) => setRange(r => ({ ...r, to: e.target.value }))} className="h-10 w-44" /></div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{fmtDate(from)} → {fmtDate(to)} • {t("cashSales")}</p>
        <p className="text-4xl font-black tabular-nums mt-1">{fmtMoney(cashSum?.total || 0)}</p>
        <p className="text-xs text-muted-foreground">{cashSum?.count || 0} invoices</p>
        <div className="h-64 mt-4">
          <ResponsiveContainer>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {purchaseTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5"><p className="text-sm text-muted-foreground">{t("itemsOnly")}</p><p className="text-2xl font-black tabular-nums text-warning mt-1">{fmtMoney(purchaseTotals.range_items)}</p></Card>
          <Card className="p-5"><p className="text-sm text-muted-foreground">{t("expensesOnly")}</p><p className="text-2xl font-black tabular-nums text-destructive mt-1">{fmtMoney(purchaseTotals.range_expenses)}</p></Card>
          <Card className="p-5"><p className="text-sm text-muted-foreground">{t("estimatedProfit")}</p>
            <p className={`text-2xl font-black tabular-nums mt-1 ${(cashSum?.total || 0) - purchaseTotals.range_items - purchaseTotals.range_expenses >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney((cashSum?.total || 0) - purchaseTotals.range_items - purchaseTotals.range_expenses)}</p>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h3 className="font-black text-lg mb-3">{t("recentSales")}</h3>
        <div className="divide-y max-h-96 overflow-y-auto">
          {recentSales.map(s => (
            <div key={s.id} className="flex justify-between py-2">
              <span>#{s.invoice_no} • {fmtDate(s.created_at)}</span>
              <span className="font-bold tabular-nums">{fmtMoney(s.amount)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
