import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated/cash-counter")({ component: CashCounter });

function CashCounter() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [last, setLast] = useState<{ invoice_no: number; amount: number; date: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: recent = [] } = useQuery({ queryKey: ["cash-recent"], queryFn: () => api().cash.recent(20) });
  const { data: today } = useQuery({ queryKey: ["cash-today"], queryFn: () => api().cash.todayTotal() });

  useEffect(() => { inputRef.current?.focus(); }, []);

  const save = async () => {
    const v = Number(amount);
    if (!v || v <= 0) { toast.error(t("invalidAmount")); inputRef.current?.focus(); return; }
    try {
      const row = await api().cash.add(v);
      const settings = await api().settings.getAll();
      // Auto silent print
      const printRes = await api().print.receipt({
        invoice_no: row.invoice_no, amount: row.amount,
        date: new Date(row.created_at).toLocaleDateString(),
        shop_name: settings.shop_name || "Milk Shop",
        logo_data_url: settings.logo_data_url || "",
      });
      if (!printRes.ok) toast.warning(`Saved. Print failed: ${printRes.error ?? ""}`);
      else toast.success(`#${row.invoice_no} • ${fmtMoney(row.amount)}`);
      setLast({ invoice_no: row.invoice_no, amount: row.amount, date: new Date(row.created_at).toLocaleString() });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["cash-recent"] });
      qc.invalidateQueries({ queryKey: ["cash-today"] });
      inputRef.current?.focus();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("cashCounter")}</h1>
        <p className="text-lg">{t("todayCash")}: <span className="font-black text-primary">{fmtMoney(today?.total ?? 0)}</span> <span className="text-sm text-muted-foreground">({today?.count ?? 0})</span></p>
      </div>

      <Card className="p-6 md:p-10 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
        <label className="block text-sm font-bold opacity-90 mb-3 uppercase tracking-wider">{t("enterAmount")}</label>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="0"
          className="w-full bg-transparent text-6xl md:text-8xl font-black tabular-nums outline-none placeholder:text-primary-foreground/30"
        />
        <p className="text-base opacity-90 mt-4 font-semibold">⏎ {t("pressEnterToPrint")}</p>
        <Button size="lg" variant="secondary" className="mt-6 h-14 px-8 text-lg font-bold" onClick={save}>
          <Printer className="w-5 h-5 mr-2" /> {t("save")} + {t("print")}
        </Button>
      </Card>

      {last && (
        <Card className="p-5 border-success/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-success text-success-foreground grid place-items-center"><Receipt className="w-6 h-6" /></div>
            <div className="flex-1">
              <p className="font-black text-lg">{t("lastInvoice")}: #{last.invoice_no}</p>
              <p className="text-sm text-muted-foreground">{last.date}</p>
            </div>
            <p className="text-2xl font-black tabular-nums">{fmtMoney(last.amount)}</p>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-black text-lg mb-4">{t("recentSales")}</h3>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noData")}</p>
        ) : (
          <div className="divide-y">
            {recent.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold">#{s.invoice_no}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(s.created_at)}</p>
                </div>
                <p className="text-lg font-black tabular-nums">{fmtMoney(s.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
