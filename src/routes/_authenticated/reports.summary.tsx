import { createFileRoute } from "@tanstack/react-router";
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
import { Printer } from "lucide-react";
import { wrapDocument, printDocument, loadShopMeta, escape as esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/reports/summary")({ component: SummaryReport });

function presetRange(p: string): { from: string; to: string } {
  const t = new Date(); const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(t);
  if (p === "today") return { from: today, to: today };
  if (p === "yesterday") { const y = new Date(t); y.setDate(t.getDate() - 1); return { from: fmt(y), to: fmt(y) }; }
  if (p === "week") { const w = new Date(t); w.setDate(t.getDate() - 6); return { from: fmt(w), to: today }; }
  if (p === "month") return { from: today.slice(0, 8) + "01", to: today };
  return { from: today.slice(0, 8) + "01", to: today };
}

function SummaryReport() {
  const { t } = useLang();
  const [preset, setPreset] = useState("month");
  const [{ from, to }, setRange] = useState(presetRange("month"));
  const set = (p: string) => { setPreset(p); setRange(presetRange(p)); };

  const today = todayISO();
  const { data: cashSum } = useQuery({ queryKey: ["sum-cash", from, to], queryFn: () => api().cash.sum(from, to) });
  const { data: udharT } = useQuery({ queryKey: ["sum-udhar", from, to], queryFn: () => api().udhar.totals(from, to) });
  const { data: monthlyT } = useQuery({ queryKey: ["sum-monthly", from, to], queryFn: () => api().monthly.totals(from, to) });
  const { data: purchT } = useQuery({ queryKey: ["sum-purch", from, to], queryFn: () => api().purchases.totals({ from, to }) });
  const { data: expCats = [] } = useQuery({ queryKey: ["sum-exp-cats", from, to], queryFn: () => api().purchases.expensesByCategory(from, to) });

  const cashSales = cashSum?.total || 0;
  const monthlyPaid = monthlyT?.paid || 0;
  const totalSales = cashSales + monthlyPaid;
  const newUdhar = udharT?.credit || 0;
  const udharCollected = udharT?.payment || 0;
  const outstandingUdhar = udharT?.outstanding || 0;
  const monthlyCharges = monthlyT?.charges || 0;
  const outstandingMonthly = monthlyT?.outstanding || 0;
  const totalPurchases = purchT?.range_items || 0;
  const totalExpenses = purchT?.range_expenses || 0;
  const profit = totalSales - totalPurchases - totalExpenses;

  const printReport = async () => {
    const meta = await loadShopMeta();
    const expRows = expCats.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${esc(fmtMoney(c.total))}</td></tr>`).join("");
    const body = `
      <div class="section"><h3>${t("sales")}</h3>
        <div class="row"><span>${t("cashSales")}</span><span>${esc(fmtMoney(cashSales))}</span></div>
        <div class="row"><span>${t("monthlyClientSales")}</span><span>${esc(fmtMoney(monthlyPaid))}</span></div>
        <div class="row" style="font-weight:800;border-top:1px solid #000;padding-top:6px"><span>${t("totalSales")}</span><span>${esc(fmtMoney(totalSales))}</span></div>
      </div>
      <div class="section"><h3>${t("udhar")}</h3>
        <div class="row"><span>${t("newUdhar")}</span><span>${esc(fmtMoney(newUdhar))}</span></div>
        <div class="row"><span>${t("udharCollections")}</span><span>${esc(fmtMoney(udharCollected))}</span></div>
        <div class="row" style="font-weight:800"><span>${t("outstandingBalance")}</span><span>${esc(fmtMoney(outstandingUdhar))}</span></div>
      </div>
      <div class="section"><h3>${t("monthlyClients")}</h3>
        <div class="row"><span>${t("monthlyCharges")}</span><span>${esc(fmtMoney(monthlyCharges))}</span></div>
        <div class="row"><span>${t("paymentsReceived")}</span><span>${esc(fmtMoney(monthlyPaid))}</span></div>
        <div class="row" style="font-weight:800"><span>${t("outstandingBalance")}</span><span>${esc(fmtMoney(outstandingMonthly))}</span></div>
      </div>
      <div class="section"><h3>${t("purchases")}</h3>
        <div class="row"><span>${t("totalPurchases")}</span><span>${esc(fmtMoney(totalPurchases))}</span></div>
      </div>
      <div class="section"><h3>${t("expenses")}</h3>
        <table><thead><tr><th>${t("category")}</th><th class="num">${t("amount")}</th></tr></thead>
        <tbody>${expRows || `<tr><td colspan="2" style="text-align:center;color:#666">${t("noData")}</td></tr>`}</tbody>
        <tfoot><tr><td>${t("total")}</td><td class="num">${esc(fmtMoney(totalExpenses))}</td></tr></tfoot></table>
      </div>
      <div class="section"><h3>${t("estimatedProfit")}</h3>
        <div class="row"><span>${t("totalSales")}</span><span>${esc(fmtMoney(totalSales))}</span></div>
        <div class="row"><span>− ${t("totalPurchases")}</span><span>${esc(fmtMoney(totalPurchases))}</span></div>
        <div class="row"><span>− ${t("expenses")}</span><span>${esc(fmtMoney(totalExpenses))}</span></div>
        <div class="row" style="font-weight:800;font-size:14pt;border-top:2px solid #000;padding-top:6px;margin-top:6px"><span>= ${t("estimatedProfit")}</span><span>${esc(fmtMoney(profit))}</span></div>
      </div>`;
    await printDocument(wrapDocument({ ...meta, title: t("summaryReport"), subtitle: `${fmtDate(from)} → ${fmtDate(to)}` }, body));
  };

  const Tile = ({ label, val, kind }: { label: string; val: number; kind?: "good" | "bad" | "warn" }) => (
    <Card className="p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={`text-xl font-black tabular-nums mt-1 ${kind === "good" ? "text-success" : kind === "bad" ? "text-destructive" : kind === "warn" ? "text-warning" : ""}`}>{fmtMoney(val)}</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("summaryReport")}</h1>
        <Button onClick={printReport} className="h-11 font-bold"><Printer className="w-4 h-4 mr-1"/>{t("printReport")}</Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[["today", t("today")], ["yesterday", t("yesterday")], ["week", t("thisWeek")], ["month", t("thisMonth")], ["custom", t("customRange")]].map(([k, l]) => (
            <button key={k} className={`h-10 px-3 rounded-md text-sm font-bold border ${preset === k ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`} onClick={() => set(k)}>{l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-2 items-end">
            <div><Label>{t("fromDate")}</Label><Input type="date" value={from} onChange={(e) => setRange(r => ({ ...r, from: e.target.value }))} className="h-10 w-44" /></div>
            <div><Label>{t("toDate")}</Label><Input type="date" value={to} onChange={(e) => setRange(r => ({ ...r, to: e.target.value }))} className="h-10 w-44" /></div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{fmtDate(from)} → {fmtDate(to)}</p>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-black mb-3">{t("sales")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile label={t("cashSales")} val={cashSales} />
          <Tile label={t("monthlyClientSales")} val={monthlyPaid} />
          <Tile label={t("totalSales")} val={totalSales} kind="good" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-black mb-3">{t("udhar")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile label={t("newUdhar")} val={newUdhar} kind="bad" />
          <Tile label={t("udharCollections")} val={udharCollected} kind="good" />
          <Tile label={t("outstandingBalance")} val={outstandingUdhar} kind="warn" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-black mb-3">{t("monthlyClients")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile label={t("monthlyCharges")} val={monthlyCharges} />
          <Tile label={t("paymentsReceived")} val={monthlyPaid} kind="good" />
          <Tile label={t("outstandingBalance")} val={outstandingMonthly} kind="warn" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-black mb-3">{t("purchases")} & {t("expenses")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Tile label={t("totalPurchases")} val={totalPurchases} kind="warn" />
          <Tile label={t("expenses")} val={totalExpenses} kind="bad" />
        </div>
        {expCats.length > 0 && (
          <div className="mt-3 divide-y">
            {expCats.map(c => (
              <div key={c.name} className="flex justify-between py-2 text-sm">
                <span>{c.name}</span>
                <span className="tabular-nums font-bold">{fmtMoney(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 border-2 border-primary">
        <h2 className="text-2xl font-black mb-3">{t("estimatedProfit")}</h2>
        <div className="space-y-1 text-base">
          <div className="flex justify-between"><span>{t("totalSales")}</span><span className="tabular-nums">{fmtMoney(totalSales)}</span></div>
          <div className="flex justify-between"><span>− {t("totalPurchases")}</span><span className="tabular-nums">{fmtMoney(totalPurchases)}</span></div>
          <div className="flex justify-between"><span>− {t("expenses")}</span><span className="tabular-nums">{fmtMoney(totalExpenses)}</span></div>
          <div className={`flex justify-between border-t-2 pt-2 mt-2 text-2xl font-black ${profit >= 0 ? "text-success" : "text-destructive"}`}>
            <span>= {t("estimatedProfit")}</span>
            <span className="tabular-nums">{fmtMoney(profit)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
