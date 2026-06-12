import { createFileRoute, Link } from "@tanstack/react-router";
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
import { fmtMoney } from "@/lib/format";
import { Plus, Search, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/udhar/")({
  component: UdharList,
});

function UdharList() {
  const { user } = useAuth();
  const { t } = useLang();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });

  const { data: customers = [] } = useQuery({
    queryKey: ["udhar-customers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: cs } = await supabase.from("udhar_customers").select("*").order("name");
      const { data: es } = await supabase.from("udhar_entries").select("customer_id, entry_type, amount");
      const balances = new Map<string, number>();
      (es ?? []).forEach((e) => {
        const cur = balances.get(e.customer_id) ?? 0;
        balances.set(e.customer_id, cur + (e.entry_type === "credit" ? Number(e.amount) : -Number(e.amount)));
      });
      return (cs ?? []).map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 }));
    },
  });

  const filtered = customers.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.mobile ?? "").includes(q),
  );

  const addCustomer = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("udhar_customers").insert({
      user_id: user!.id, name: form.name.trim(), mobile: form.mobile.trim() || null, address: form.address.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    setForm({ name: "", mobile: "", address: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["udhar-customers"] });
  };

  const totalOutstanding = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{t("udhar")}</h1>
          <p className="text-muted-foreground mt-1">{t("outstandingUdhar")}: <span className="font-bold text-foreground">{fmtMoney(totalOutstanding)}</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="font-bold"><Plus className="w-5 h-5 mr-2" />{t("addCustomer")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addCustomer")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
              <div><Label>{t("mobile")}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={20} /></div>
              <div><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={255} /></div>
              <Button onClick={addCustomer} className="w-full">{t("save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-10 h-12" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && <p className="text-muted-foreground col-span-full">{t("noData")}</p>}
        {filtered.map((c) => (
          <Link key={c.id} to="/udhar/$customerId" params={{ customerId: c.id }}>
            <Card className="p-5 hover:border-primary transition cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-accent/20 grid place-items-center shrink-0">
                  <User className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{c.name}</p>
                  {c.mobile && <p className="text-xs text-muted-foreground">{c.mobile}</p>}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black stat-number ${c.balance > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(c.balance)}</p>
                  <p className="text-xs text-muted-foreground">{t("balance")}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
