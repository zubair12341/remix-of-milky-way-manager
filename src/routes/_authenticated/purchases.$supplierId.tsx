import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Milk, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/purchases/$supplierId")({ component: SupplierDetail });

function SupplierDetail() {
  const { supplierId } = Route.useParams();
  const sid = Number(supplierId);
  const { t } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: supplier } = useQuery({ queryKey: ["supplier", sid], queryFn: () => api().purchases.supplier(sid) });
  const { data: entries = [] } = useQuery({ queryKey: ["supplier-entries", sid], queryFn: () => api().purchases.supplierEntries(sid) });

  const totalPurchase = entries.filter(e => e.type === "purchase").reduce((a, e) => a + e.amount, 0);
  const totalPaid = entries.filter(e => e.type === "payment").reduce((a, e) => a + e.amount, 0);
  const balance = totalPurchase - totalPaid;

  const [pOpen, setPOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [payAmount, setPayAmount] = useState("");

  const total = useMemo(() => (Number(qty) || 0) * (Number(rate) || 0), [qty, rate]);

  const addPurchase = async () => {
    const q = Number(qty), r = Number(rate);
    if (!q || !r) return toast.error(t("invalidAmount"));
    await api().purchases.addEntry({
      supplierId: sid, type: "purchase", itemName: item || "Milk", qty: q, rate: r, amount: q * r,
      paidNow: Number(paidNow) || 0, note, entry_date: date,
    });
    qc.invalidateQueries({ queryKey: ["supplier-entries", sid] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["purchase-totals"] });
    qc.invalidateQueries({ queryKey: ["purchases"] });
    setPOpen(false); setItem(""); setQty(""); setRate(""); setPaidNow(""); setNote(""); setDate(todayISO());
    toast.success(t("saved"));
  };

  const addPayment = async () => {
    const a = Number(payAmount);
    if (!a) return toast.error(t("invalidAmount"));
    await api().purchases.addEntry({ supplierId: sid, type: "payment", amount: a, note, entry_date: date });
    qc.invalidateQueries({ queryKey: ["supplier-entries", sid] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setPayOpen(false); setPayAmount(""); setNote(""); setDate(todayISO());
    toast.success(t("saved"));
  };

  const remove = async () => {
    if (!confirm("Delete supplier and all entries?")) return;
    await api().purchases.deleteSupplier(sid);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    navigate({ to: "/purchases/suppliers" });
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black">{supplier?.name ?? "…"}</h1>
            <p className="text-muted-foreground">{supplier?.mobile ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("balanceOwed")}</p>
            <p className={`text-4xl font-black tabular-nums ${balance > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(balance)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-lg bg-warning/10 text-warning p-3 text-center">
            <p className="text-xs">{t("totalPurchase")}</p>
            <p className="font-black text-lg">{fmtMoney(totalPurchase)}</p>
          </div>
          <div className="rounded-lg bg-success/10 text-success p-3 text-center">
            <p className="text-xs">{t("totalPaid")}</p>
            <p className="font-black text-lg">{fmtMoney(totalPaid)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Dialog open={pOpen} onOpenChange={setPOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-16 text-lg font-bold bg-warning hover:bg-warning/90 text-warning-foreground">
              <Milk className="w-5 h-5 mr-2" />{t("addPurchase")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addPurchase")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("item")}</Label><Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Milk" autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("quantityL")}</Label><Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
                <div><Label>{t("ratePerLiter")}</Label><Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              </div>
              <div className="rounded-lg bg-muted p-3 flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">{t("total")}</span>
                <span className="text-2xl font-black tabular-nums">{fmtMoney(total)}</span>
              </div>
              <div><Label>{t("paidNow")}</Label><Input type="number" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0 = full credit" /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><Label>{t("notes")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={addPurchase} className="font-bold">{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-16 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground">
              <Wallet className="w-5 h-5 mr-2" />{t("payToSupplier")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("payToSupplier")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("amount")}</Label><Input type="number" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><Label>{t("notes")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={addPayment} className="font-bold">{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <h3 className="font-black text-lg mb-3">{t("ledger")}</h3>
        {entries.length === 0 ? <p className="text-muted-foreground text-sm">{t("noData")}</p> : (
          <div className="divide-y">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {e.type === "purchase" ? (e.item_name || t("purchase")) : t("payment")}
                    {e.type === "purchase" && e.qty ? <span className="ml-2 text-sm text-muted-foreground">{e.qty}{e.unit ? e.unit : "L"} × {fmtMoney(e.rate || 0)}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.entry_date)}{e.note ? " • " + e.note : ""}</p>
                </div>
                <p className={`text-lg font-black tabular-nums ${e.type === "purchase" ? "text-warning" : "text-success"}`}>
                  {e.type === "purchase" ? "+" : "−"}{fmtMoney(e.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button variant="outline" onClick={remove} className="text-destructive border-destructive/40">
        <Trash2 className="w-4 h-4 mr-2" /> {t("deleteSupplier")}
      </Button>
    </div>
  );
}
