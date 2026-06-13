import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/udhar/")({ component: UdharList });

function UdharList() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ["udhar-customers"], queryFn: () => api().udhar.customers() });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });

  const filtered = customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.mobile || "").includes(q));
  const totalOut = customers.reduce((a, c) => a + Math.max(c.balance, 0), 0);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await api().udhar.addCustomer(form);
    setOpen(false); setForm({ name: "", mobile: "", address: "" });
    qc.invalidateQueries({ queryKey: ["udhar-customers"] });
    toast.success(t("saved"));
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("udhar")}</h1>
        <p className="text-lg">{t("outstandingUdhar")}: <span className="font-black text-destructive">{fmtMoney(totalOut)}</span></p>
      </div>

      <div className="flex gap-2">
        <Input placeholder={t("search") + "..."} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 text-base" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12 font-bold"><Plus className="w-5 h-5 mr-1" /> {t("addCustomer")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addCustomer")}</DialogTitle></DialogHeader>
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
        {filtered.map(c => (
          <Link key={c.id} to="/udhar/$customerId" params={{ customerId: String(c.id) }}>
            <Card className="p-4 hover:border-primary transition cursor-pointer flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center"><UserIcon /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{c.name}</p>
                <p className="text-sm text-muted-foreground truncate">{c.mobile || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("balance")}</p>
                <p className={`text-xl font-black tabular-nums ${c.balance > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(c.balance)}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
