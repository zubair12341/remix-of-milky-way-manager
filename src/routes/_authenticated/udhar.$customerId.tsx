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
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/udhar/$customerId")({
  component: CustomerLedger,
});

function CustomerLedger() {
  const { customerId } = Route.useParams();
  const { user } = useAuth();
  const { t, dir } = useLang();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());

  const { data } = useQuery({
    queryKey: ["udhar-customer", customerId],
    enabled: !!user,
    queryFn: async () => {
      const [c, e] = await Promise.all([
        supabase.from("udhar_customers").select("*").eq("id", customerId).single(),
        supabase.from("udhar_entries").select("*").eq("customer_id", customerId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      ]);
      return { customer: c.data, entries: e.data ?? [] };
    },
  });

  const customer = data?.customer;
  const entries = data?.entries ?? [];
  const totalCredit = entries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = entries.filter((e) => e.entry_type === "payment").reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalCredit - totalPaid;

  const addEntry = async (entry_type: "credit" | "payment") => {
    const v = Number(amount);
    if (!v || v <= 0) { toast.error("Enter amount"); return; }
    const { error } = await supabase.from("udhar_entries").insert({
      user_id: user!.id, customer_id: customerId, entry_type, amount: v, entry_date: date, notes: notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    setAmount(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["udhar-customer", customerId] });
    qc.invalidateQueries({ queryKey: ["udhar-customers"] });
  };

  if (!customer) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <Link to="/udhar" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`} /> {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{customer.name}</h1>
          {customer.mobile && <p className="text-sm text-muted-foreground">{customer.mobile}</p>}
          {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t("balance")}</p>
          <p className={`text-3xl font-black stat-number ${balance > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(balance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("totalCredit")}</p><p className="text-lg font-bold">{fmtMoney(totalCredit)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("totalReceived")}</p><p className="text-lg font-bold">{fmtMoney(totalPaid)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("remaining")}</p><p className="text-lg font-bold">{fmtMoney(balance)}</p></Card>
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-bold">{t("addCredit")} / {t("receivePayment")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>{t("amount")}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg font-bold" /></div>
          <div><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12" /></div>
          <div><Label>{t("notes")}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={255} className="h-12" /></div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => addEntry("credit")} className="flex-1 h-12 font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"><Plus className="w-4 h-4 mr-2" />{t("addCredit")}</Button>
          <Button onClick={() => addEntry("payment")} className="flex-1 h-12 font-bold bg-success hover:bg-success/90 text-success-foreground"><Minus className="w-4 h-4 mr-2" />{t("receivePayment")}</Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-3">{t("ledger")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b">
              <tr><th className="text-left py-2">{t("date")}</th><th className="text-right py-2">{t("credit")}</th><th className="text-right py-2">{t("payment")}</th><th className="text-left py-2 ps-4">{t("notes")}</th></tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">{t("noData")}</td></tr>}
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2">{fmtDate(e.entry_date)}</td>
                  <td className="text-right tabular-nums text-destructive font-semibold">{e.entry_type === "credit" ? fmtMoney(e.amount) : ""}</td>
                  <td className="text-right tabular-nums text-success font-semibold">{e.entry_type === "payment" ? fmtMoney(e.amount) : ""}</td>
                  <td className="ps-4 text-muted-foreground">{e.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
