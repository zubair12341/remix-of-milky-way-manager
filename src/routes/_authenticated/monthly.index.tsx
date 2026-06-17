import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Truck, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api, type MonthlyClient } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/monthly/")({ component: MonthlyList });

const blank = { name: "", mobile: "", address: "", daily_qty: "1", milk_type: "cow", rate: "200", active: 1 };

function MonthlyList() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ["monthly"], queryFn: () => api().monthly.list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [q, setQ] = useState("");
  const [milkFilter, setMilkFilter] = useState<"all" | "cow" | "buffalo" | "mixed">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await api().monthly.add({
      name: form.name, mobile: form.mobile, address: form.address,
      daily_qty: Number(form.daily_qty), milk_type: form.milk_type,
      rate: Number(form.rate), active: form.active as any,
    } as any);
    setForm(blank); setOpen(false);
    qc.invalidateQueries({ queryKey: ["monthly"] });
    toast.success(t("saved"));
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete client?")) return;
    await api().monthly.delete(id);
    qc.invalidateQueries({ queryKey: ["monthly"] });
  };

  const ql = q.toLowerCase().trim();
  const filtered = clients.filter(c => {
    if (ql && !(c.name.toLowerCase().includes(ql) || (c.mobile || "").includes(ql))) return false;
    if (milkFilter !== "all" && c.milk_type !== milkFilter) return false;
    if (statusFilter === "active" && !c.active) return false;
    if (statusFilter === "inactive" && c.active) return false;
    return true;
  });
  const totalCharges = filtered.reduce((a, c) => a + (c.month_amount || 0), 0);
  const totalPaid = filtered.reduce((a, c) => a + (c.paid_this_month || 0), 0);
  const totalOutstanding = filtered.reduce((a, c) => a + Math.max(0, c.balance || 0), 0);

  const fb = "h-9 px-3 rounded-md text-sm font-bold border";
  const aA = "bg-primary text-primary-foreground border-primary";
  const aI = "bg-background border-input hover:bg-muted";

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("monthlyClients")}</h1>
        <div className="flex gap-2">
          <Link to="/monthly/deliveries"><Button size="lg" className="h-12 font-bold" variant="outline"><Truck className="w-5 h-5 mr-1" /> {t("dailyDeliveries")}</Button></Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12 font-bold"><Plus className="w-5 h-5 mr-1" /> {t("addClient")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("addClient")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{t("mobile")}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                  <div><Label>{t("status")}</Label>
                    <select className="w-full h-10 rounded-md border border-input px-3 bg-background" value={form.active} onChange={(e) => setForm({ ...form, active: Number(e.target.value) })}>
                      <option value={1}>{t("active")}</option><option value={0}>{t("inactive")}</option>
                    </select>
                  </div>
                </div>
                <div><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>{t("dailyQuantity")}</Label><Input type="number" value={form.daily_qty} onChange={(e) => setForm({ ...form, daily_qty: e.target.value })} /></div>
                  <div><Label>{t("ratePerLiter")}</Label><Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
                </div>
                <div><Label>{t("milkType")}</Label>
                  <select className="w-full h-10 rounded-md border border-input px-3 bg-background" value={form.milk_type} onChange={(e) => setForm({ ...form, milk_type: e.target.value })}>
                    <option value="cow">{t("cow")}</option><option value="buffalo">{t("buffalo")}</option><option value="mixed">{t("mixed")}</option>
                  </select>
                </div>
              </div>
              <DialogFooter><Button onClick={add}>{t("save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("monthlyCharges")} ({filtered.length})</p><p className="text-2xl font-black text-primary tabular-nums">{fmtMoney(totalCharges)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("paidThisMonth")}</p><p className="text-2xl font-black text-green-600 tabular-nums">{fmtMoney(totalPaid)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("outstandingBalance")}</p><p className="text-2xl font-black text-destructive tabular-nums">{fmtMoney(totalOutstanding)}</p></Card>
      </div>

      <Card className="p-4 space-y-3">
        <Input placeholder={t("search") + "..."} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 text-base" autoFocus />
        <div className="flex flex-wrap gap-2">
          {(["all","cow","buffalo","mixed"] as const).map(k => (
            <button key={k} className={`${fb} ${milkFilter === k ? aA : aI}`} onClick={() => setMilkFilter(k)}>{k === "all" ? "All" : t(k)}</button>
          ))}
          <span className="w-px bg-border mx-1" />
          {(["all","active","inactive"] as const).map(k => (
            <button key={k} className={`${fb} ${statusFilter === k ? aA : aI}`} onClick={() => setStatusFilter(k)}>{k === "all" ? "Any" : t(k)}</button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">{t("noData")}</Card>}
        {filtered.map(c => (
          <Link key={c.id} to="/monthly/$clientId" params={{ clientId: String(c.id) }} className={c.paused ? "opacity-60" : ""}>
            <Card className="p-4 flex items-center gap-4 flex-wrap hover:border-primary transition cursor-pointer">
              <div className="flex-1 min-w-[200px]">
                <p className="font-bold text-lg">
                  {c.name}
                  {!c.active && <span className="ml-2 text-xs font-normal text-muted-foreground">({t("inactive")})</span>}
                  {c.paused ? <span className="ml-2 text-xs font-bold text-warning">{t("paused")} → {c.pause_end}</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">{c.mobile || "—"} • {c.daily_qty}L {t(c.milk_type as any)} @ {fmtMoney(c.rate)}/L</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">{t("monthlyCharges")}</p>
                <p className="text-base font-bold tabular-nums">{fmtMoney(c.month_amount || 0)}</p>
                <p className="text-[10px] text-muted-foreground">{(c.month_qty || 0).toFixed(1)}L</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">{t("paidThisMonth")}</p>
                <p className="text-base font-bold tabular-nums text-green-600">{fmtMoney(c.paid_this_month || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">{t("balance")}</p>
                <p className={`text-xl font-black tabular-nums ${(c.balance||0) > 0 ? "text-destructive" : "text-green-600"}`}>{fmtMoney(c.balance || 0)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => remove(c.id, e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-center pt-4">
        <Link to="/monthly/deliveries" className="inline-flex items-center gap-2 text-primary font-bold underline">
          <ListChecks className="w-4 h-4" /> {t("dailyDeliveries")}
        </Link>
      </div>
    </div>
  );
}
