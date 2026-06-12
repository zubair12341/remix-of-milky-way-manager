import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney, monthISO } from "@/lib/format";
import { Plus, User, CheckCircle2, Circle, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/monthly")({
  component: MonthlyClients,
});

function MonthlyClients() {
  const { user } = useAuth();
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "", daily_quantity: "1", milk_type: "cow", rate_per_liter: "200" });
  const month = monthISO();

  const { data: clients = [] } = useQuery({
    queryKey: ["monthly-clients", user?.id, month],
    enabled: !!user,
    queryFn: async () => {
      const { data: cs } = await supabase.from("monthly_clients").select("*").order("name");
      const { data: bills } = await supabase.from("monthly_bills").select("*").eq("billing_month", month);
      const billMap = new Map((bills ?? []).map((b) => [b.client_id, b]));
      return (cs ?? []).map((c) => ({ ...c, currentBill: billMap.get(c.id) }));
    },
  });

  const addClient = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("monthly_clients").insert({
      user_id: user!.id,
      name: form.name.trim(),
      mobile: form.mobile || null,
      address: form.address || null,
      daily_quantity: Number(form.daily_quantity) || 0,
      milk_type: form.milk_type,
      rate_per_liter: Number(form.rate_per_liter) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    setForm({ name: "", mobile: "", address: "", daily_quantity: "1", milk_type: "cow", rate_per_liter: "200" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["monthly-clients"] });
  };

  const generateBill = async (client: any) => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const qty = Number(client.daily_quantity) * daysInMonth;
    const amt = qty * Number(client.rate_per_liter);
    const { error } = await supabase.from("monthly_bills").upsert({
      user_id: user!.id, client_id: client.id, billing_month: month,
      total_quantity: qty, total_amount: amt,
      amount_paid: client.currentBill?.amount_paid ?? 0,
      status: (client.currentBill?.amount_paid ?? 0) >= amt ? "paid" : (client.currentBill?.amount_paid ?? 0) > 0 ? "partial" : "unpaid",
    }, { onConflict: "client_id,billing_month" });
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["monthly-clients"] });
  };

  const markPaid = async (client: any) => {
    if (!client.currentBill) { toast.error("Generate bill first"); return; }
    const { error } = await supabase.from("monthly_bills").update({
      amount_paid: client.currentBill.total_amount,
      status: "paid",
    }).eq("id", client.currentBill.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["monthly-clients"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{t("monthlyClients")}</h1>
          <p className="text-muted-foreground mt-1">{t("billingMonth")}: {new Date(month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="font-bold"><Plus className="w-5 h-5 mr-2" />{t("addClient")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("addClient")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("mobile")}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={20} /></div>
                <div><Label>{t("milkType")}</Label>
                  <Select value={form.milk_type} onValueChange={(v) => setForm({ ...form, milk_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cow">{t("cow")}</SelectItem>
                      <SelectItem value="buffalo">{t("buffalo")}</SelectItem>
                      <SelectItem value="mixed">{t("mixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={255} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("dailyQuantity")}</Label><Input type="number" step="0.5" value={form.daily_quantity} onChange={(e) => setForm({ ...form, daily_quantity: e.target.value })} /></div>
                <div><Label>{t("ratePerLiter")}</Label><Input type="number" value={form.rate_per_liter} onChange={(e) => setForm({ ...form, rate_per_liter: e.target.value })} /></div>
              </div>
              <Button onClick={addClient} className="w-full">{t("save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clients.length === 0 && <p className="text-muted-foreground col-span-full">{t("noData")}</p>}
        {clients.map((c) => {
          const isPaid = c.currentBill?.status === "paid";
          return (
            <Card key={c.id} className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/15 grid place-items-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.daily_quantity}L/day • {t(c.milk_type as any)} • Rs {c.rate_per_liter}/L</p>
                </div>
                {isPaid ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
              </div>
              {c.currentBill ? (
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("monthlyBill")}</span><span className="font-semibold">{c.currentBill.total_quantity}L</span></div>
                  <div className="flex justify-between"><span className="text-sm">{t("total")}</span><span className="font-black stat-number">{fmtMoney(c.currentBill.total_amount)}</span></div>
                  <div className={`text-xs font-bold mt-1 ${isPaid ? "text-success" : "text-destructive"}`}>{t(c.currentBill.status as any)}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No bill for this month yet</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => generateBill(c)} className="flex-1">{t("generateBill")}</Button>
                {c.currentBill && !isPaid && <Button size="sm" onClick={() => markPaid(c)} className="bg-success hover:bg-success/90 text-success-foreground">{t("markPaid")}</Button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
