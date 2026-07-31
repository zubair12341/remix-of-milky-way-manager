import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { Printer } from "lucide-react";
import { wrapDocument, printDocument, loadShopMeta, escape as esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/reports/ghee")({ component: GheeReport });

const kg = (n: number) => `${Number(n || 0).toFixed(3).replace(/\.?0+$/, "")} KG`;

function GheeReport() {
  const t0 = todayISO();
  const [from, setFrom] = useState(t0.slice(0, 8) + "01");
  const [to, setTo] = useState(t0);

  const { data: r } = useQuery({ queryKey: ["ghee-report", from, to], queryFn: () => api().ghee.report({ from, to }) });

  const print = async () => {
    if (!r) return;
    const meta = await loadShopMeta();
    const body = `
      <div class="totals">
        <div class="box"><div class="l">Total Purchased</div><div class="v">${esc(kg(r.purchased_kg))}</div></div>
        <div class="box"><div class="l">Total Sold</div><div class="v">${esc(kg(r.sold_kg))}</div></div>
        <div class="box"><div class="l">Remaining Stock</div><div class="v">${esc(kg(r.remaining_kg))}</div></div>
        <div class="box"><div class="l">Total Sales Amount</div><div class="v">${esc(fmtMoney(r.sales_amount))}</div></div>
      </div>
      <div class="section"><h3>Sales by Date</h3>
        <table><thead><tr><th>Date</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody>
        ${r.sales_by_date.map(s => `<tr><td>${esc(fmtDate(s.day))}</td><td class="num">${esc(kg(s.qty_kg))}</td><td class="num">${esc(fmtMoney(s.amount))}</td></tr>`).join("")}
        </tbody></table></div>
      <div class="section"><h3>Purchase History</h3>
        <table><thead><tr><th>Date</th><th class="num">Qty</th></tr></thead><tbody>
        ${r.purchases_by_date.map(p => `<tr><td>${esc(fmtDate(p.day))}</td><td class="num">${esc(kg(p.qty_kg))}</td></tr>`).join("")}
        </tbody></table></div>`;
    await printDocument(wrapDocument({ ...meta, title: "Desi Ghee Report", subtitle: `${from} to ${to}` }, body));
  };

  const Bucket = ({ title, rows }: { title: string; rows: { key: string; qty_kg: number; amount: number }[] }) => (
    <Card className="p-5">
      <h3 className="font-black mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No sales</p> : (
        <div className="divide-y text-sm">
          {rows.slice(0, 12).map(b => (
            <div key={b.key} className="flex justify-between py-2">
              <span className="font-medium">{b.key}</span>
              <span className="tabular-nums">{kg(b.qty_kg)} · <span className="font-bold">{fmtMoney(b.amount)}</span></span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-black">Desi Ghee Report</h1>
        <Button variant="outline" onClick={print}><Printer className="w-4 h-4 mr-2" /> Print Report</Button>
      </div>

      <Card className="p-5 flex flex-wrap gap-4 items-end">
        <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5"><p className="text-xs uppercase font-bold text-muted-foreground">Purchased</p><p className="text-2xl font-black tabular-nums">{kg(r?.purchased_kg ?? 0)}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase font-bold text-muted-foreground">Sold</p><p className="text-2xl font-black tabular-nums">{kg(r?.sold_kg ?? 0)}</p></Card>
        <Card className="p-5 border-primary/40"><p className="text-xs uppercase font-bold text-muted-foreground">Remaining</p><p className="text-2xl font-black tabular-nums text-primary">{kg(r?.remaining_kg ?? 0)}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase font-bold text-muted-foreground">Sales Amount</p><p className="text-2xl font-black tabular-nums">{fmtMoney(r?.sales_amount ?? 0)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Bucket title="Daily" rows={r?.daily ?? []} />
        <Bucket title="Weekly (week starting)" rows={r?.weekly ?? []} />
        <Bucket title="Monthly" rows={r?.monthly ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-black text-lg mb-3">Sales by Date</h3>
          {(r?.sales_by_date.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
            <div className="divide-y">
              {r!.sales_by_date.map(s => (
                <div key={s.day} className="flex justify-between py-2">
                  <span>{fmtDate(s.day)}</span>
                  <span className="tabular-nums">{kg(s.qty_kg)} · <span className="font-bold">{fmtMoney(s.amount)}</span></span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="font-black text-lg mb-3">Purchase History by Date</h3>
          {(r?.purchases_by_date.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
            <div className="divide-y">
              {r!.purchases_by_date.map(p => (
                <div key={p.day} className="flex justify-between py-2">
                  <span>{fmtDate(p.day)}</span>
                  <span className="tabular-nums font-bold">{kg(p.qty_kg)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
