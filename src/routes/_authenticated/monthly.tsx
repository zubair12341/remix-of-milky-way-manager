import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api, type MonthlyClient } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/monthly")({ component: Monthly });

const blank = { name: "", mobile: "", daily_qty: "1", milk_type: "cow", rate: "200" };
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const monthlyBillOf = (c: MonthlyClient) => c.daily_qty * c.rate * 30;

function Monthly() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ["monthly"], queryFn: () => api().monthly.list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [q, setQ] = useState("");
  const [milkFilter, setMilkFilter] = useState<"all" | "cow" | "buffalo" | "mixed">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [payClient, setPayClient] = useState<MonthlyClient | null>(null);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await api().monthly.add({
      name: form.name, mobile: form.mobile,
      daily_qty: Number(form.daily_qty), milk_type: form.milk_type, rate: Number(form.rate),
    } as any);
    setForm(blank); setOpen(false);
    qc.invalidateQueries({ queryKey: ["monthly"] });
    toast.success(t("saved"));
  };

  const remove = async (id: number) => {
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
  const totalMonthly = filtered.reduce((a, c) => a + monthlyBillOf(c), 0);
  const totalPaid = filtered.reduce((a, c) => a + (c.paid_this_month || 0), 0);
  const totalPending = Math.max(0, totalMonthly - totalPaid);

  const filterBtn = "h-9 px-3 rounded-md text-sm font-bold border";
  const active = "bg-primary text-primary-foreground border-primary";
  const idle = "bg-background border-input hover:bg-muted";

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("monthlyClients")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12 font-bold"><Plus className="w-5 h-5 mr-1" /> {t("addClient")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addClient")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
              <div><Label>{t("mobile")}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t("dailyQuantity")}</Label><Input type="number" value={form.daily_qty} onChange={(e) => setForm({ ...form, daily_qty: e.target.value })} /></div>
                <div><Label>{t("ratePerLiter")}</Label><Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
              </div>
              <div>
                <Label>{t("milkType")}</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 bg-background" value={form.milk_type} onChange={(e) => setForm({ ...form, milk_type: e.target.value })}>
                  <option value="cow">{t("cow")}</option>
                  <option value="buffalo">{t("buffalo")}</option>
                  <option value="mixed">{t("mixed")}</option>
                </select>
              </div>
            </div>
            <DialogFooter><Button onClick={add}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("monthlyBill")} ({filtered.length})</p><p className="text-2xl font-black text-primary tabular-nums">{fmtMoney(totalMonthly)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("paidThisMonth")}</p><p className="text-2xl font-black text-green-600 tabular-nums">{fmtMoney(totalPaid)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("pending")}</p><p className="text-2xl font-black text-destructive tabular-nums">{fmtMoney(totalPending)}</p></Card>
      </div>

      <Card className="p-4 space-y-3">
        <Input placeholder={t("search") + "..."} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 text-base" autoFocus />
        <div className="flex flex-wrap gap-2">
          <button className={`${filterBtn} ${milkFilter === "all" ? active : idle}`} onClick={() => setMilkFilter("all")}>All</button>
          <button className={`${filterBtn} ${milkFilter === "cow" ? active : idle}`} onClick={() => setMilkFilter("cow")}>{t("cow")}</button>
          <button className={`${filterBtn} ${milkFilter === "buffalo" ? active : idle}`} onClick={() => setMilkFilter("buffalo")}>{t("buffalo")}</button>
          <button className={`${filterBtn} ${milkFilter === "mixed" ? active : idle}`} onClick={() => setMilkFilter("mixed")}>{t("mixed")}</button>
          <span className="w-px bg-border mx-1" />
          <button className={`${filterBtn} ${statusFilter === "all" ? active : idle}`} onClick={() => setStatusFilter("all")}>Any</button>
          <button className={`${filterBtn} ${statusFilter === "active" ? active : idle}`} onClick={() => setStatusFilter("active")}>Active</button>
          <button className={`${filterBtn} ${statusFilter === "inactive" ? active : idle}`} onClick={() => setStatusFilter("inactive")}>Inactive</button>
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">{t("noData")}</Card>}
        {filtered.map(c => {
          const monthly = monthlyBillOf(c);
          const paid = c.paid_this_month || 0;
          const pending = Math.max(0, monthly - paid);
          const cleared = paid >= monthly && monthly > 0;
          return (
            <Card key={c.id} className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="font-bold text-lg">{c.name} {!c.active && <span className="text-xs font-normal text-muted-foreground">(inactive)</span>}</p>
                <p className="text-sm text-muted-foreground">{c.mobile || "—"} • {c.daily_qty}L {t(c.milk_type as any)} @ {fmtMoney(c.rate)}/L</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">{t("monthlyBill")}</p>
                <p className="text-base font-bold tabular-nums">{fmtMoney(monthly)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">{t("paidThisMonth")}</p>
                <p className="text-base font-bold tabular-nums text-green-600">{fmtMoney(paid)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">{t("pending")}</p>
                <p className={`text-xl font-black tabular-nums ${cleared ? "text-green-600" : "text-destructive"}`}>{cleared ? "✓" : fmtMoney(pending)}</p>
              </div>
              <Button size="sm" className="h-10 font-bold" onClick={() => setPayClient(c)}>
                <Wallet className="w-4 h-4 mr-1" /> {t("recordPayment")}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </Card>
          );
        })}
      </div>

      {payClient && <PaymentDialog client={payClient} onClose={() => setPayClient(null)} />}
    </div>
  );
}

function PaymentDialog({ client, onClose }: { client: MonthlyClient; onClose: () => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: payments = [] } = useQuery({ queryKey: ["monthly", client.id, "payments"], queryFn: () => api().monthly.payments(client.id) });
  const monthly = monthlyBillOf(client);
  const paidThisMonth = client.paid_this_month || 0;
  const pending = Math.max(0, monthly - paidThisMonth);
  const [amount, setAmount] = useState(String(pending || ""));
  const [period, setPeriod] = useState(currentPeriod());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const save = async () => {
    const a = Number(amount);
    if (!a || a <= 0) return toast.error("Enter amount");
    await api().monthly.addPayment({ clientId: client.id, amount: a, period, entry_date: date, note });
    setAmount(""); setNote("");
    qc.invalidateQueries({ queryKey: ["monthly", client.id, "payments"] });
    qc.invalidateQueries({ queryKey: ["monthly"] });
    toast.success(t("saved"));
  };
  const del = async (id: number) => {
    if (!confirm("Delete payment?")) return;
    await api().monthly.deletePayment(id);
    qc.invalidateQueries({ queryKey: ["monthly", client.id, "payments"] });
    qc.invalidateQueries({ queryKey: ["monthly"] });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{client.name} — {t("recordPayment")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">{t("monthlyBill")}</p><p className="font-black tabular-nums">{fmtMoney(monthly)}</p></div>
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">{t("paidThisMonth")}</p><p className="font-black tabular-nums text-green-600">{fmtMoney(paidThisMonth)}</p></div>
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">{t("pending")}</p><p className="font-black tabular-nums text-destructive">{fmtMoney(pending)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
          <div><Label>{t("period")}</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <Button className="font-bold" onClick={save}>{t("save")}</Button>

        <div className="space-y-1 max-h-64 overflow-auto">
          <p className="text-sm font-bold mt-2">{t("paymentHistory")}</p>
          {payments.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">{t("noData")}</p>}
          {payments.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-sm border rounded-md px-2 py-1">
              <span className="font-mono">{p.period}</span>
              <span className="text-muted-foreground">{p.entry_date}</span>
              <span className="flex-1 truncate">{p.note}</span>
              <span className="font-bold tabular-nums text-green-600">{fmtMoney(p.amount)}</span>
              <Button variant="ghost" size="icon" onClick={() => del(p.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
