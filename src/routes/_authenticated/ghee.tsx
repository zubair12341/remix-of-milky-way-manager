import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { FileBarChart, PackagePlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ghee")({ component: GheePage });

const UNITS = [
  { label: "1 KG", kg: 1 },
  { label: "1/2 KG", kg: 0.5 },
  { label: "1/4 KG", kg: 0.25 },
  { label: "Custom", kg: 0 },
];

const kg = (n: number) => `${Number(n || 0).toFixed(3).replace(/\.?0+$/, "")} KG`;

function GheePage() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ghee-stock"] });
    qc.invalidateQueries({ queryKey: ["ghee-purchases"] });
    qc.invalidateQueries({ queryKey: ["ghee-sales"] });
  };

  const { data: stock } = useQuery({ queryKey: ["ghee-stock"], queryFn: () => api().ghee.stock() });
  const { data: purchases = [] } = useQuery({ queryKey: ["ghee-purchases"], queryFn: () => api().ghee.purchases(50) });
  const { data: sales = [] } = useQuery({ queryKey: ["ghee-sales"], queryFn: () => api().ghee.sales(50) });

  // purchase form
  const [pQty, setPQty] = useState("");
  const [pDate, setPDate] = useState(todayISO());
  const [pNote, setPNote] = useState("");

  // sale form
  const [unitIdx, setUnitIdx] = useState(0);
  const [customKg, setCustomKg] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sDate, setSDate] = useState(todayISO());

  const selectedKg = UNITS[unitIdx].kg || Number(customKg) || 0;

  const savePurchase = async () => {
    try {
      await api().ghee.addPurchase({ qty_kg: Number(pQty), entry_date: pDate, note: pNote || undefined });
      toast.success(`Added ${kg(Number(pQty))} to stock`);
      setPQty(""); setPNote(""); refresh();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const saveSale = async () => {
    try {
      const row = await api().ghee.addSale({
        qty_kg: selectedKg,
        amount: Number(sAmount),
        mode: UNITS[unitIdx].kg ? "weight" : "amount",
        entry_date: sDate,
      });
      const settings = await api().settings.getAll();
      const printRes = await api().print.gheeReceipt({
        invoice_no: row.id!,
        qty_kg: row.qty_kg,
        amount: row.amount,
        date: new Date(row.created_at).toLocaleDateString(),
        shop_name: settings.shop_name || "Milk Shop",
        logo_data_url: settings.logo_data_url || "",
      });
      if (!printRes.ok) toast.warning(`Saved. Print failed: ${printRes.error ?? ""}`);
      else toast.success(`Sold ${kg(selectedKg)} • ${fmtMoney(Number(sAmount))}`);
      setSAmount(""); setCustomKg(""); refresh();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };


  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-black">Desi Ghee</h1>
        <Button variant="outline" asChild>
          <Link to="/reports/ghee"><FileBarChart className="w-4 h-4 mr-2" /> Desi Ghee Report</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Total Purchased</p>
          <p className="text-3xl font-black tabular-nums">{kg(stock?.purchased_kg ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Total Sold</p>
          <p className="text-3xl font-black tabular-nums">{kg(stock?.sold_kg ?? 0)}</p>
        </Card>
        <Card className="p-5 border-primary/40">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Remaining Stock</p>
          <p className="text-3xl font-black tabular-nums text-primary">{kg(stock?.remaining_kg ?? 0)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase */}
        <Card className="p-6 space-y-4">
          <h2 className="font-black text-xl flex items-center gap-2"><PackagePlus className="w-5 h-5" /> Purchase Desi Ghee</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity (KG)</Label>
              <Input type="number" inputMode="decimal" step="0.001" value={pQty}
                onChange={e => setPQty(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); savePurchase(); } }}
                placeholder="0" className="text-2xl font-black h-14" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className="h-14" />
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={pNote} onChange={e => setPNote(e.target.value)} placeholder="Supplier / remarks" />
          </div>
          <Button className="w-full h-12 text-base font-bold" onClick={savePurchase}>Add Purchase</Button>
        </Card>

        {/* Sale */}
        <Card className="p-6 space-y-4">
          <h2 className="font-black text-xl">Sell Desi Ghee</h2>
          <div>
            <Label>Weight</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {UNITS.map((u, i) => (
                <Button key={u.label} type="button" variant={i === unitIdx ? "default" : "outline"}
                  className="font-bold" onClick={() => setUnitIdx(i)}>{u.label}</Button>
              ))}
            </div>
          </div>
          {!UNITS[unitIdx].kg && (
            <div>
              <Label>Custom weight (KG)</Label>
              <Input type="number" inputMode="decimal" step="0.001" value={customKg}
                onChange={e => setCustomKg(e.target.value)} placeholder="e.g. 0.75" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount Received (Rs)</Label>
              <Input type="number" inputMode="decimal" value={sAmount}
                onChange={e => setSAmount(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveSale(); } }}
                placeholder="0" className="text-2xl font-black h-14" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="h-14" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Deducts <span className="font-bold text-foreground">{kg(selectedKg)}</span> from stock ·
            available <span className="font-bold text-foreground">{kg(stock?.remaining_kg ?? 0)}</span>
          </p>
          <Button className="w-full h-12 text-base font-bold" onClick={saveSale}
            disabled={!selectedKg || selectedKg > (stock?.remaining_kg ?? 0)}>
            Save Sale
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-black text-lg mb-3">Recent Purchases</h3>
          {purchases.length === 0 ? <p className="text-sm text-muted-foreground">No purchases yet</p> : (
            <div className="divide-y">
              {purchases.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                  <div>
                    <p className="font-bold tabular-nums">{kg(p.qty_kg)}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(p.entry_date)}{p.note ? ` • ${p.note}` : ""}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={async () => { await api().ghee.deletePurchase(p.id!); refresh(); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-black text-lg mb-3">Recent Sales</h3>
          {sales.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet</p> : (
            <div className="divide-y">
              {sales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                  <div>
                    <p className="font-bold tabular-nums">{kg(s.qty_kg)}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(s.entry_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black tabular-nums">{fmtMoney(s.amount)}</p>
                    <Button size="icon" variant="ghost" onClick={async () => { await api().ghee.deleteSale(s.id!); refresh(); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
