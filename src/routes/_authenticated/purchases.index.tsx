import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api, type PurchaseCategory } from "@/lib/db";
import { fmtMoney, fmtDate, todayISO } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { wrapDocument, printDocument, loadShopMeta, escape as esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/purchases/")({ component: PurchasesHub });

function PurchasesHub() {
  const { t } = useLang();
  const qc = useQueryClient();
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<"" | "item" | "expense">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [q, setQ] = useState("");

  const { data: categories = [] } = useQuery({ queryKey: ["purchase-categories"], queryFn: () => api().purchases.categories() });
  const { data: entries = [] } = useQuery({
    queryKey: ["purchases", from, to, kind, categoryId, q],
    queryFn: () => api().purchases.entries({ from, to, kind: kind || undefined, categoryId: categoryId || undefined, q: q || undefined }),
  });
  const { data: totals } = useQuery({ queryKey: ["purchase-totals", from, to], queryFn: () => api().purchases.totals({ from, to }) });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => api().purchases.suppliers() });

  // Add entry form
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ entry_date: today, categoryId: "" as number | "", supplierId: "" as number | "", itemName: "", qty: "", unit: "L", rate: "", amount: "", paidNow: "", note: "" });

  const computedAmount = form.amount ? Number(form.amount) : (Number(form.qty) || 0) * (Number(form.rate) || 0);

  const addEntry = async () => {
    if (!computedAmount) return toast.error(t("invalidAmount"));
    await api().purchases.addEntry({
      entry_date: form.entry_date,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      supplierId: form.supplierId ? Number(form.supplierId) : null,
      itemName: form.itemName || undefined,
      qty: form.qty ? Number(form.qty) : undefined,
      unit: form.unit || undefined,
      rate: form.rate ? Number(form.rate) : undefined,
      amount: computedAmount,
      paidNow: form.paidNow ? Number(form.paidNow) : 0,
      note: form.note,
      type: "purchase",
    });
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["purchase-totals"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setOpen(false);
    setForm({ entry_date: today, categoryId: "", supplierId: "", itemName: "", qty: "", unit: "L", rate: "", amount: "", paidNow: "", note: "" });
    toast.success(t("saved"));
  };

  // Category quick-add
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", kind: "item" as "item" | "expense" });
  const addCat = async () => {
    if (!newCat.name.trim()) return;
    await api().purchases.addCategory({ name: newCat.name.trim(), kind: newCat.kind });
    qc.invalidateQueries({ queryKey: ["purchase-categories"] });
    setCatOpen(false); setNewCat({ name: "", kind: "item" });
  };

  const delEntry = async (id: number) => {
    if (!confirm("Delete?")) return;
    await api().purchases.deleteEntry(id);
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["purchase-totals"] });
  };

  const printLedger = async () => {
    const meta = await loadShopMeta();
    const sum = entries.reduce((a, e) => a + (e.type === "purchase" ? e.amount : 0), 0);
    const rowsHtml = entries.map(e => `<tr><td>${esc(fmtDate(e.entry_date))}</td><td>${esc(e.category_name || "—")}</td><td>${esc(e.item_name || (e.type === "payment" ? t("payment") : "—"))}</td><td>${esc(e.supplier_name || "—")}</td><td class="num">${e.qty ?? ""}</td><td class="num">${e.rate ? esc(fmtMoney(e.rate)) : ""}</td><td class="num">${esc(fmtMoney(e.amount))}</td></tr>`).join("");
    const body = `
      <table>
        <thead><tr><th>${t("date")}</th><th>${t("category")}</th><th>${t("item")}</th><th>${t("addSupplier").replace("Add ","")}</th><th class="num">${t("quantity")}</th><th class="num">${t("rate")}</th><th class="num">${t("amount")}</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="6">${t("total")}</td><td class="num">${esc(fmtMoney(sum))}</td></tr></tfoot>
      </table>`;
    await printDocument(wrapDocument({ ...meta, title: t("purchaseReport"), subtitle: `${fmtDate(from)} → ${fmtDate(to)}` }, body));
  };

  const groupedCats = (kind?: "item" | "expense") => categories.filter(c => !kind || c.kind === kind);

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("purchases")}</h1>
        <div className="flex gap-2">
          <Link to="/purchases/suppliers"><Button variant="outline" className="h-11"><Truck className="w-4 h-4 mr-1"/>{t("suppliers")}</Button></Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="h-11 font-bold"><Plus className="w-4 h-4 mr-1"/>{t("addPurchase")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("addPurchase")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("date")}</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
                <div>
                  <Label>{t("category")}</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : "" })}>
                    <option value="">—</option>
                    <optgroup label={t("itemsOnly")}>{groupedCats("item").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                    <optgroup label={t("expensesOnly")}>{groupedCats("expense").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                  </select>
                  <button type="button" onClick={() => setCatOpen(true)} className="text-xs text-primary mt-1 underline">+ {t("addCategory")}</button>
                </div>
                <div className="col-span-2"><Label>{t("item")}</Label><Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g., Milk, Sugar, Electricity bill" /></div>
                <div><Label>{t("quantity")}</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
                <div><Label>{t("unit")}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="L, kg, pcs" /></div>
                <div><Label>{t("rate")}</Label><Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
                <div><Label>{t("amount")}</Label><Input type="number" value={form.amount || (computedAmount || "")} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>{t("suppliers")}</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value ? Number(e.target.value) : "" })}>
                    <option value="">— None (cash) —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {form.supplierId && (
                  <div className="col-span-2"><Label>{t("paidNow")}</Label><Input type="number" value={form.paidNow} onChange={(e) => setForm({ ...form, paidNow: e.target.value })} placeholder="0 = full credit" /></div>
                )}
                <div className="col-span-2"><Label>{t("notes")}</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={addEntry} className="font-bold">{t("save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t("todayPurchase")}</p><p className="text-xl font-black tabular-nums">{fmtMoney(totals.today)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t("monthPurchase")}</p><p className="text-xl font-black tabular-nums">{fmtMoney(totals.month)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t("itemsOnly")} ({t("fromDate")}–{t("toDate")})</p><p className="text-xl font-black tabular-nums">{fmtMoney(totals.range_items)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">{t("expensesOnly")} ({t("fromDate")}–{t("toDate")})</p><p className="text-xl font-black tabular-nums text-destructive">{fmtMoney(totals.range_expenses)}</p></Card>
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div><Label>{t("fromDate")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" /></div>
          <div><Label>{t("toDate")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" /></div>
          <div className="flex-1 min-w-[160px]"><Label>{t("search")}</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search") + "..."} className="h-10" /></div>
          <div><Label>{t("category")}</Label>
            <select className="h-10 rounded-md border border-input bg-background px-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("allCategories")}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            {[["", "All"], ["item", t("itemsOnly")], ["expense", t("expensesOnly")]].map(([k, l]) => (
              <button key={k} className={`h-10 px-3 rounded-md text-sm font-bold border ${kind === k ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`} onClick={() => setKind(k as any)}>{l}</button>
            ))}
          </div>
          <Button onClick={printLedger} variant="outline" className="h-10"><Printer className="w-4 h-4 mr-1"/>{t("print")}</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase bg-muted">
              <tr><th className="text-left p-2">{t("date")}</th><th className="text-left p-2">{t("category")}</th><th className="text-left p-2">{t("item")}</th><th className="text-left p-2">{t("suppliers")}</th><th className="text-right p-2">{t("quantity")}</th><th className="text-right p-2">{t("rate")}</th><th className="text-right p-2">{t("amount")}</th><th></th></tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-8">{t("noData")}</td></tr>}
              {entries.map(e => (
                <tr key={e.id} className="border-t hover:bg-muted/50">
                  <td className="p-2 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                  <td className="p-2">{e.category_name || "—"} {e.category_kind === "expense" && <span className="text-[10px] text-destructive">●</span>}</td>
                  <td className="p-2">{e.item_name || (e.type === "payment" ? <em className="text-success">{t("payment")}</em> : "—")}{e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}</td>
                  <td className="p-2 text-muted-foreground">{e.supplier_name || "—"}</td>
                  <td className="p-2 text-right tabular-nums">{e.qty ?? ""}{e.qty != null ? (e.unit || "L") : ""}</td>
                  <td className="p-2 text-right tabular-nums">{e.rate ? fmtMoney(e.rate) : ""}</td>
                  <td className={`p-2 text-right tabular-nums font-bold ${e.type === "payment" ? "text-success" : ""}`}>{e.type === "payment" ? "−" : ""}{fmtMoney(e.amount)}</td>
                  <td className="p-2"><Button variant="ghost" size="icon" onClick={() => delEntry(e.id)}><Trash2 className="w-3 h-3 text-destructive"/></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addCategory")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>{t("categoryName")}</Label><Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} autoFocus /></div>
            <div className="col-span-2"><Label>{t("categoryKind")}</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as any })}>
                <option value="item">{t("itemsOnly")}</option><option value="expense">{t("expensesOnly")}</option>
              </select>
            </div>
          </div>
          <DialogFooter><Button onClick={addCat}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
