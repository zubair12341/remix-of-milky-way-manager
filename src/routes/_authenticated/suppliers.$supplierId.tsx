import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/db";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadShopMeta, printDocument, wrapDocument, escape } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/suppliers/$supplierId")({ component: SupplierDetail });

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

function SupplierDetail() {
  const { supplierId } = Route.useParams();
  const qc = useQueryClient();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");
  const [pOpen, setPOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [purchase, setPurchase] = useState({ entry_date: today(), invoice_no: "", item_name: "", qty: "", unit: "L", rate: "", amount: "", payment_mode: "credit", notes: "" });
  const [payment, setPayment] = useState({ entry_date: today(), amount: "", mode: "cash", reference_no: "", notes: "" });

  const { data: supplier } = useQuery({ queryKey: ["sl-supplier", supplierId], queryFn: () => api().supplierLedger.supplier(supplierId) });
  const { data: ledger } = useQuery({ queryKey: ["sl-ledger", supplierId, from, to, q], queryFn: () => api().supplierLedger.ledger({ supplierId, from, to, q }) });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["sl-supplier", supplierId] }); qc.invalidateQueries({ queryKey: ["sl-ledger", supplierId] }); qc.invalidateQueries({ queryKey: ["sl-suppliers"] }); };

  const addPurchase = useMutation({
    mutationFn: () => api().supplierLedger.addPurchase({
      supplier_id: supplierId,
      entry_date: purchase.entry_date,
      invoice_no: purchase.invoice_no,
      item_name: purchase.item_name,
      qty: purchase.qty ? Number(purchase.qty) : undefined,
      unit: purchase.unit,
      rate: purchase.rate ? Number(purchase.rate) : undefined,
      amount: purchase.amount ? Number(purchase.amount) : undefined,
      payment_mode: purchase.payment_mode as "cash" | "credit",
      notes: purchase.notes,
    }),
    onSuccess: () => { invalidate(); setPOpen(false); setPurchase({ entry_date: today(), invoice_no: "", item_name: "", qty: "", unit: "L", rate: "", amount: "", payment_mode: "credit", notes: "" }); toast.success("Purchase recorded"); },
  });

  const addPayment = useMutation({
    mutationFn: () => api().supplierLedger.addPayment({
      supplier_id: supplierId,
      entry_date: payment.entry_date,
      amount: Number(payment.amount),
      mode: payment.mode as any,
      reference_no: payment.reference_no,
      notes: payment.notes,
    }),
    onSuccess: () => { invalidate(); setPayOpen(false); setPayment({ entry_date: today(), amount: "", mode: "cash", reference_no: "", notes: "" }); toast.success("Payment recorded"); },
  });

  const delPurchase = useMutation({ mutationFn: (id: string) => api().supplierLedger.deletePurchase(id), onSuccess: invalidate });
  const delPayment = useMutation({ mutationFn: (id: string) => api().supplierLedger.deletePayment(id), onSuccess: invalidate });

  const doPrint = async () => {
    if (!supplier || !ledger) return;
    const meta = await loadShopMeta();
    const totalDebit = ledger.rows.reduce((a, r) => a + r.debit, 0);
    const totalCredit = ledger.rows.reduce((a, r) => a + r.credit, 0);
    const body = `
      <div><strong>Supplier:</strong> ${escape(supplier.name)} ${supplier.mobile ? "· " + escape(supplier.mobile) : ""}</div>
      <div class="sub">Period: ${from} to ${to}</div>
      <div class="row" style="margin-top:8px"><span>Opening balance</span><span><strong>Rs. ${ledger.opening.toLocaleString()}</strong></span></div>
      <table><thead><tr><th>Date</th><th>Particulars</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
      <tbody>
        ${ledger.rows.map(r => `<tr>
          <td>${r.entry_date}</td>
          <td>${r.kind === "purchase" ? `Purchase ${escape(r.invoice_no || "")} ${escape(r.item_name || "")} ${r.qty != null ? `(${r.qty}${r.unit || ""} × ${r.rate ?? ""})` : ""} ${r.payment_mode === "cash" ? "<em>[cash]</em>" : ""}` : `Payment via ${escape(r.mode || "")} ${escape(r.reference_no || "")}`}${r.notes ? ` — ${escape(r.notes)}` : ""}</td>
          <td class="num">${r.debit ? "Rs. " + r.debit.toLocaleString() : ""}</td>
          <td class="num">${r.credit ? "Rs. " + r.credit.toLocaleString() : ""}</td>
          <td class="num">Rs. ${r.balance.toLocaleString()}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr><td colspan="2">Totals</td><td class="num">Rs. ${totalDebit.toLocaleString()}</td><td class="num">Rs. ${totalCredit.toLocaleString()}</td><td class="num">Rs. ${ledger.closing.toLocaleString()}</td></tr></tfoot>
      </table>`;
    printDocument(wrapDocument({ ...meta, title: "Supplier Ledger", subtitle: supplier.name }, body));
  };

  if (!supplier) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black">{supplier.name}</h1>
          <p className="text-muted-foreground">{supplier.mobile || "—"} {supplier.address ? `· ${supplier.address}` : ""}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase">Outstanding</div>
          <div className={`text-2xl font-black ${(supplier.outstanding || 0) > 0 ? "text-destructive" : ""}`}>Rs. {(supplier.outstanding || 0).toLocaleString()}</div>
        </div>
      </div>

      <Card className="p-4 grid md:grid-cols-5 gap-3 items-end">
        <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="md:col-span-2 relative">
          <Label>Search</Label>
          <Search className="absolute left-3 bottom-3 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Invoice, item, note…" />
        </div>
        <Button variant="outline" onClick={doPrint}><Printer className="w-4 h-4 mr-1" /> Print</Button>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Dialog open={pOpen} onOpenChange={setPOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Add purchase</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New purchase</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Date</Label><Input type="date" value={purchase.entry_date} onChange={e => setPurchase({ ...purchase, entry_date: e.target.value })} /></div>
                <div><Label>Invoice #</Label><Input value={purchase.invoice_no} onChange={e => setPurchase({ ...purchase, invoice_no: e.target.value })} /></div>
              </div>
              <div><Label>Item</Label><Input value={purchase.item_name} onChange={e => setPurchase({ ...purchase, item_name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Qty</Label><Input type="number" value={purchase.qty} onChange={e => setPurchase({ ...purchase, qty: e.target.value })} /></div>
                <div><Label>Unit</Label><Input value={purchase.unit} onChange={e => setPurchase({ ...purchase, unit: e.target.value })} /></div>
                <div><Label>Rate</Label><Input type="number" value={purchase.rate} onChange={e => setPurchase({ ...purchase, rate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Amount (override)</Label><Input type="number" value={purchase.amount} onChange={e => setPurchase({ ...purchase, amount: e.target.value })} placeholder={String((Number(purchase.qty)||0)*(Number(purchase.rate)||0) || "")} /></div>
                <div><Label>Payment</Label>
                  <select className="w-full h-10 rounded-md border px-3 bg-background" value={purchase.payment_mode} onChange={e => setPurchase({ ...purchase, payment_mode: e.target.value })}>
                    <option value="credit">On credit</option><option value="cash">Cash (paid now)</option>
                  </select>
                </div>
              </div>
              <div><Label>Notes</Label><Input value={purchase.notes} onChange={e => setPurchase({ ...purchase, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={() => addPurchase.mutate()} disabled={addPurchase.isPending}>Save purchase</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-1" /> Add payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Date</Label><Input type="date" value={payment.entry_date} onChange={e => setPayment({ ...payment, entry_date: e.target.value })} /></div>
                <div><Label>Amount *</Label><Input type="number" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Mode</Label>
                  <select className="w-full h-10 rounded-md border px-3 bg-background" value={payment.mode} onChange={e => setPayment({ ...payment, mode: e.target.value })}>
                    <option value="cash">Cash</option><option value="bank">Bank</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option>
                  </select>
                </div>
                <div><Label>Reference #</Label><Input value={payment.reference_no} onChange={e => setPayment({ ...payment, reference_no: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={payment.notes} onChange={e => setPayment({ ...payment, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={() => Number(payment.amount) > 0 ? addPayment.mutate() : toast.error("Amount required")} disabled={addPayment.isPending}>Save payment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">Date</th><th className="p-3">Particulars</th>
              <th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th>
              <th className="p-3 text-right">Balance</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t bg-muted/40"><td className="p-3" colSpan={4}><em>Opening balance</em></td><td className="p-3 text-right font-bold">Rs. {(ledger?.opening || 0).toLocaleString()}</td><td /></tr>
            {(ledger?.rows || []).map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{r.entry_date}</td>
                <td className="p-3">
                  {r.kind === "purchase"
                    ? <>Purchase {r.invoice_no ? `#${r.invoice_no} ` : ""}{r.item_name || ""} {r.qty != null ? <span className="text-muted-foreground">({r.qty}{r.unit || ""} × {r.rate ?? ""})</span> : null} {r.payment_mode === "cash" && <span className="text-xs px-1.5 rounded bg-muted">cash</span>}</>
                    : <>Payment <span className="text-xs px-1.5 rounded bg-muted">{r.mode}</span> {r.reference_no ? `#${r.reference_no}` : ""}</>}
                  {r.notes ? <div className="text-xs text-muted-foreground">{r.notes}</div> : null}
                </td>
                <td className="p-3 text-right">{r.debit ? `Rs. ${r.debit.toLocaleString()}` : ""}</td>
                <td className="p-3 text-right">{r.credit ? `Rs. ${r.credit.toLocaleString()}` : ""}</td>
                <td className="p-3 text-right font-semibold">Rs. {r.balance.toLocaleString()}</td>
                <td className="p-3"><Button variant="ghost" size="sm" onClick={() => r.kind === "purchase" ? delPurchase.mutate(r.id) : delPayment.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
              </tr>
            ))}
            {(ledger?.rows.length || 0) === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No entries in this period.</td></tr>}
          </tbody>
          {(ledger?.rows.length || 0) > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="p-3" colSpan={2}>Closing balance</td>
                <td className="p-3 text-right">Rs. {(ledger?.rows.reduce((a, r) => a + r.debit, 0) || 0).toLocaleString()}</td>
                <td className="p-3 text-right">Rs. {(ledger?.rows.reduce((a, r) => a + r.credit, 0) || 0).toLocaleString()}</td>
                <td className="p-3 text-right">Rs. {(ledger?.closing || 0).toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}
