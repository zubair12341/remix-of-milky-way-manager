import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, Trash2, Printer, Pause } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { wrapDocument, printDocument, loadShopMeta, escape as esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/monthly/$clientId")({ component: ClientLedger });

function ClientLedger() {
  const { clientId } = Route.useParams();
  const cid = Number(clientId);
  const { t } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: client } = useQuery({ queryKey: ["monthly-client", cid], queryFn: () => api().monthly.client(cid) });
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const { data: deliveries = [] } = useQuery({ queryKey: ["client-deliveries", cid, from, to], queryFn: () => api().monthly.deliveries(from, to, cid) });
  const { data: payments = [] } = useQuery({ queryKey: ["client-payments", cid], queryFn: () => api().monthly.payments(cid) });
  const { data: pauses = [] } = useQuery({ queryKey: ["client-pauses", cid], queryFn: () => api().monthly.pauses(cid) });

  // Build ledger
  const ledger = useMemo(() => {
    const events: Array<{ date: string; desc: string; debit: number; credit: number }> = [];
    for (const d of deliveries) {
      if (d.status === "skipped") continue;
      events.push({ date: d.entry_date, desc: `${t("delivered")} ${d.delivered_qty}L × ${fmtMoney(d.rate)}`, debit: d.amount, credit: 0 });
    }
    for (const p of payments) {
      if (p.entry_date < from || p.entry_date > to) continue;
      events.push({ date: p.entry_date, desc: `${t("payment")}${p.note ? " — " + p.note : ""}`, debit: 0, credit: p.amount });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return events.map(e => { bal += e.debit - e.credit; return { ...e, balance: bal }; });
  }, [deliveries, payments, from, to, t]);

  const totalDebit = ledger.reduce((a, e) => a + e.debit, 0);
  const totalCredit = ledger.reduce((a, e) => a + e.credit, 0);
  const closing = totalDebit - totalCredit;

  // payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [pAmount, setPAmount] = useState("");
  const [pNote, setPNote] = useState("");
  const [pDate, setPDate] = useState(today);
  const addPayment = async () => {
    const a = Number(pAmount); if (!a) return toast.error(t("invalidAmount"));
    await api().monthly.addPayment({ clientId: cid, amount: a, entry_date: pDate, note: pNote });
    qc.invalidateQueries({ queryKey: ["client-payments", cid] });
    qc.invalidateQueries({ queryKey: ["monthly-client", cid] });
    qc.invalidateQueries({ queryKey: ["monthly"] });
    setPayOpen(false); setPAmount(""); setPNote("");
    toast.success(t("saved"));
  };

  // pause dialog
  const [pauseOpen, setPauseOpen] = useState(false);
  const [psStart, setPsStart] = useState(today);
  const [psEnd, setPsEnd] = useState(today);
  const [psReason, setPsReason] = useState("");
  const addPause = async () => {
    if (psEnd < psStart) return toast.error("Invalid dates");
    await api().monthly.addPause({ clientId: cid, start_date: psStart, end_date: psEnd, reason: psReason });
    qc.invalidateQueries({ queryKey: ["client-pauses", cid] });
    qc.invalidateQueries({ queryKey: ["monthly"] });
    setPauseOpen(false); setPsReason("");
    toast.success(t("saved"));
  };
  const delPause = async (id: number) => { await api().monthly.deletePause(id); qc.invalidateQueries({ queryKey: ["client-pauses", cid] }); };

  const remove = async () => { if (!confirm("Delete client?")) return; await api().monthly.delete(cid); qc.invalidateQueries({ queryKey: ["monthly"] }); navigate({ to: "/monthly" }); };

  const printLedger = async () => {
    const meta = await loadShopMeta();
    const rowsHtml = ledger.map(e => `<tr><td>${esc(fmtDate(e.date))}</td><td>${esc(e.desc)}</td><td class="num">${e.debit ? esc(fmtMoney(e.debit)) : ""}</td><td class="num">${e.credit ? esc(fmtMoney(e.credit)) : ""}</td><td class="num">${esc(fmtMoney(e.balance))}</td></tr>`).join("");
    const body = `
      <div class="totals">
        <div class="box"><div class="l">${t("name")}</div><div class="v">${esc(client?.name)}</div><div class="sub">${esc(client?.mobile || "")} ${esc(client?.address || "")}</div></div>
        <div class="box"><div class="l">${t("closingBalance")}</div><div class="v">${esc(fmtMoney(closing))}</div></div>
      </div>
      <table style="margin-top:14px">
        <thead><tr><th>${t("date")}</th><th>${t("description")}</th><th class="num">${t("debit")}</th><th class="num">${t("credit2")}</th><th class="num">${t("balance")}</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px">${t("noData")}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="2">${t("total")}</td><td class="num">${esc(fmtMoney(totalDebit))}</td><td class="num">${esc(fmtMoney(totalCredit))}</td><td class="num">${esc(fmtMoney(closing))}</td></tr></tfoot>
      </table>`;
    await printDocument(wrapDocument({ ...meta, title: t("customerLedger"), subtitle: `${fmtDate(from)} → ${fmtDate(to)}` }, body));
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black">{client?.name ?? "…"}</h1>
            <p className="text-muted-foreground">{client?.mobile ?? "—"} {client?.address ? " • " + client.address : ""}</p>
            <p className="text-xs text-muted-foreground mt-1">{client?.daily_qty}L {client?.milk_type ? t(client.milk_type as any) : ""} @ {fmtMoney(client?.rate || 0)}/L</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("balance")}</p>
            <p className={`text-4xl font-black tabular-nums ${(client?.balance||0) > 0 ? "text-destructive" : "text-success"}`}>{fmtMoney(client?.balance || 0)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
          <div className="rounded-lg bg-primary/10 text-primary p-3 text-center"><p className="text-xs">{t("monthlyCharges")}</p><p className="font-black text-lg">{fmtMoney(client?.charges || 0)}</p></div>
          <div className="rounded-lg bg-success/10 text-success p-3 text-center"><p className="text-xs">{t("totalReceived")}</p><p className="font-black text-lg">{fmtMoney(client?.paid || 0)}</p></div>
          <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-center"><p className="text-xs">{t("outstandingBalance")}</p><p className="font-black text-lg">{fmtMoney(Math.max(0, client?.balance || 0))}</p></div>
        </div>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild><Button size="lg" className="h-12 font-bold"><Wallet className="w-5 h-5 mr-1"/>{t("recordPayment")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("recordPayment")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("amount")}</Label><Input type="number" value={pAmount} onChange={(e) => setPAmount(e.target.value)} autoFocus /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} /></div>
              <div className="col-span-2"><Label>{t("notes")}</Label><Input value={pNote} onChange={(e) => setPNote(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={addPayment}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
          <DialogTrigger asChild><Button size="lg" variant="outline" className="h-12 font-bold"><Pause className="w-5 h-5 mr-1"/>{t("pauseDelivery")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addPause")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("startDate")}</Label><Input type="date" value={psStart} onChange={(e) => setPsStart(e.target.value)} /></div>
              <div><Label>{t("endDate")}</Label><Input type="date" value={psEnd} onChange={(e) => setPsEnd(e.target.value)} /></div>
              <div className="col-span-2"><Label>{t("reason")}</Label><Input value={psReason} onChange={(e) => setPsReason(e.target.value)} placeholder="Vacation, etc." /></div>
            </div>
            <DialogFooter><Button onClick={addPause}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Button size="lg" variant="outline" className="h-12 font-bold" onClick={printLedger}><Printer className="w-5 h-5 mr-1"/>{t("print")}</Button>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-2 flex-wrap mb-3">
          <div><Label>{t("fromDate")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-44" /></div>
          <div><Label>{t("toDate")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-44" /></div>
        </div>
        <h3 className="font-black text-lg mb-2">{t("ledger")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b"><th className="text-left py-2">{t("date")}</th><th className="text-left">{t("description")}</th><th className="text-right">{t("debit")}</th><th className="text-right">{t("credit2")}</th><th className="text-right">{t("balance")}</th></tr>
            </thead>
            <tbody>
              {ledger.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">{t("noData")}</td></tr>}
              {ledger.map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td>{e.desc}</td>
                  <td className="text-right tabular-nums text-warning">{e.debit ? fmtMoney(e.debit) : ""}</td>
                  <td className="text-right tabular-nums text-success">{e.credit ? fmtMoney(e.credit) : ""}</td>
                  <td className="text-right tabular-nums font-bold">{fmtMoney(e.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className="border-t-2"><td colSpan={2} className="py-2">{t("total")}</td><td className="text-right tabular-nums">{fmtMoney(totalDebit)}</td><td className="text-right tabular-nums">{fmtMoney(totalCredit)}</td><td className="text-right tabular-nums">{fmtMoney(closing)}</td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {pauses.length > 0 && (
        <Card className="p-4">
          <h3 className="font-black text-lg mb-2">{t("pauseDelivery")}</h3>
          <div className="divide-y">
            {pauses.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>{fmtDate(p.start_date)} → {fmtDate(p.end_date)} {p.reason ? "• " + p.reason : ""}</span>
                <Button variant="ghost" size="icon" onClick={() => delPause(p.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button variant="outline" onClick={remove} className="text-destructive border-destructive/40"><Trash2 className="w-4 h-4 mr-2" /> {t("delete")}</Button>
    </div>
  );
}
