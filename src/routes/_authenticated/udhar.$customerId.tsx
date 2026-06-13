import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/udhar/$customerId")({ component: Ledger });

function Ledger() {
  const { customerId } = Route.useParams();
  const cid = Number(customerId);
  const { t } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: customer } = useQuery({ queryKey: ["udhar-customer", cid], queryFn: () => api().udhar.customer(cid) });
  const { data: entries = [] } = useQuery({ queryKey: ["udhar-entries", cid], queryFn: () => api().udhar.entries(cid) });

  const totalCredit = entries.filter(e => e.type === "credit").reduce((a, e) => a + e.amount, 0);
  const totalPaid = entries.filter(e => e.type === "payment").reduce((a, e) => a + e.amount, 0);
  const balance = totalCredit - totalPaid;

  const [open, setOpen] = useState<null | "credit" | "payment">(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());

  const add = async () => {
    if (!open || !Number(amount)) return toast.error("Invalid amount");
    await api().udhar.addEntry({ customerId: cid, type: open, amount: Number(amount), note, entry_date: date });
    qc.invalidateQueries({ queryKey: ["udhar-entries", cid] });
    qc.invalidateQueries({ queryKey: ["udhar-customers"] });
    setOpen(null); setAmount(""); setNote(""); setDate(todayISO());
    toast.success(t("saved"));
  };

  const remove = async () => {
    if (!confirm("Delete customer and all their entries?")) return;
    await api().udhar.deleteCustomer(cid);
    qc.invalidateQueries({ queryKey: ["udhar-customers"] });
    navigate({ to: "/udhar" });
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black">{customer?.name ?? "…"}</h1>
            <p className="text-muted-foreground">{customer?.mobile ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("balance")}</p>
            <p className={`text-4xl font-black tabular-nums ${balance > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(balance)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-center">
            <p className="text-xs">{t("totalCredit")}</p>
            <p className="font-black text-lg">{fmtMoney(totalCredit)}</p>
          </div>
          <div className="rounded-lg bg-success/10 text-success p-3 text-center">
            <p className="text-xs">{t("totalReceived")}</p>
            <p className="font-black text-lg">{fmtMoney(totalPaid)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Dialog open={open === "credit"} onOpenChange={(o) => setOpen(o ? "credit" : null)}>
          <DialogTrigger asChild><Button size="lg" variant="destructive" className="h-16 text-lg font-bold"><ArrowUp className="w-5 h-5 mr-2" />{t("addCredit")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addCredit")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("amount")}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><Label>{t("notes")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={add}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open === "payment"} onOpenChange={(o) => setOpen(o ? "payment" : null)}>
          <DialogTrigger asChild><Button size="lg" className="h-16 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground"><ArrowDown className="w-5 h-5 mr-2" />{t("receivePayment")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("receivePayment")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("amount")}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><Label>{t("notes")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={add}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <h3 className="font-black text-lg mb-3">{t("ledger")}</h3>
        {entries.length === 0 ? <p className="text-muted-foreground text-sm">{t("noData")}</p> : (
          <div className="divide-y">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold">{e.type === "credit" ? t("credit") : t("payment")}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.entry_date)} {e.note ? "• " + e.note : ""}</p>
                </div>
                <p className={`text-lg font-black tabular-nums ${e.type === "credit" ? "text-destructive" : "text-success"}`}>
                  {e.type === "credit" ? "+" : "−"}{fmtMoney(e.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button variant="outline" onClick={remove} className="text-destructive border-destructive/40"><Trash2 className="w-4 h-4 mr-2" /> {t("deleteCustomer")}</Button>
    </div>
  );
}
