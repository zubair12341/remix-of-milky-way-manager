import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/db";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers/")({ component: SuppliersList });

function SuppliersList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "", opening_balance: "0", notes: "" });

  const { data: suppliers = [] } = useQuery({ queryKey: ["sl-suppliers", q], queryFn: () => api().supplierLedger.suppliers(q) });
  const totalOwed = suppliers.reduce((a, s) => a + (s.outstanding || 0), 0);

  const add = useMutation({
    mutationFn: () => api().supplierLedger.addSupplier({ name: form.name.trim(), mobile: form.mobile, address: form.address, opening_balance: Number(form.opening_balance) || 0, notes: form.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sl-suppliers"] }); setOpen(false); setForm({ name: "", mobile: "", address: "", opening_balance: "0", notes: "" }); toast.success("Supplier added"); },
  });

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2"><Users className="w-7 h-7" /> Suppliers</h1>
          <p className="text-muted-foreground">Supplier ledger · Total outstanding <span className="font-semibold text-foreground">Rs. {totalOwed.toLocaleString()}</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New supplier</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Mobile</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
                <div><Label>Opening balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={() => form.name.trim() ? add.mutate() : toast.error("Name required")} disabled={add.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search suppliers…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="grid gap-2">
        {suppliers.length === 0 && <p className="text-muted-foreground text-center py-12">No suppliers yet.</p>}
        {suppliers.map(s => (
          <Link key={s.id} to="/suppliers/$supplierId" params={{ supplierId: s.id }}>
            <Card className="p-4 hover:bg-accent/40 transition flex items-center justify-between">
              <div>
                <div className="font-bold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.mobile || "—"} {s.address ? `· ${s.address}` : ""}</div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${(s.outstanding || 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>Rs. {(s.outstanding || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">outstanding</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
