import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/monthly")({ component: Monthly });

const blank = { name: "", mobile: "", daily_qty: "1", milk_type: "cow", rate: "200" };

function Monthly() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ["monthly"], queryFn: () => api().monthly.list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

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

      <div className="grid gap-3">
        {clients.length === 0 && <Card className="p-8 text-center text-muted-foreground">{t("noData")}</Card>}
        {clients.map(c => {
          const monthly = c.daily_qty * c.rate * 30;
          return (
            <Card key={c.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.mobile || "—"} • {c.daily_qty}L {t(c.milk_type as any)} @ {fmtMoney(c.rate)}/L</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("monthlyBill")}</p>
                <p className="text-xl font-black tabular-nums">{fmtMoney(monthly)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
