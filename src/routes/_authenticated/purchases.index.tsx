import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/purchases/")({ component: SuppliersList });

function SuppliersList() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => api().purchases.suppliers() });
  const { data: totals } = useQuery({ queryKey: ["purchase-totals"], queryFn: () => api().purchases.totals() });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });

  const ql = q.toLowerCase().trim();
  const filtered = suppliers.filter(s =>
    !ql || s.name.toLowerCase().includes(ql) || (s.mobile || "").includes(ql)
  );
  const totalOwed = suppliers.reduce((a, s) => a + Math.max(s.balance, 0), 0);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await api().purchases.addSupplier(form);
    setOpen(false); setForm({ name: "", mobile: "", address: "" });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    toast.success(t("saved"));
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("purchases")}</h1>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t("owedToSuppliers")}</p>
          <p className="text-2xl font-black text-destructive tabular-nums">{fmtMoney(totalOwed)}</p>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("todayPurchase")}</p>
            <p className="text-xl font-black tabular-nums">{fmtMoney(totals.today)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("monthPurchase")}</p>
            <p className="text-xl font-black tabular-nums">{fmtMoney(totals.month)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("totalPurchase")}</p>
            <p className="text-xl font-black tabular-nums">{fmtMoney(totals.all)}</p>
          </Card>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Input placeholder={t("search") + "..."} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 text-base flex-1 min-w-[200px]" autoFocus />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12 font-bold"><Plus className="w-5 h-5 mr-1" /> {t("addSupplier")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addSupplier")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
              <div><Label>{t("mobile")}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
              <div><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add} className="font-bold">{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">{t("noData")}</Card>}
        {filtered.map(s => (
          <Link key={s.id} to="/purchases/$supplierId" params={{ supplierId: String(s.id) }}>
            <Card className="p-4 hover:border-primary transition cursor-pointer flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-warning/10 text-warning grid place-items-center"><Truck /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{s.name}</p>
                <p className="text-sm text-muted-foreground truncate">{s.mobile || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("balance")}</p>
                <p className={`text-xl font-black tabular-nums ${s.balance > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(s.balance)}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
