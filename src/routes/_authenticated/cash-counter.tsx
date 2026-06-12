import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { Printer, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { InvoicePrint } from "@/components/InvoicePrint";

export const Route = createFileRoute("/_authenticated/cash-counter")({
  component: CashCounter,
});

function CashCounter() {
  const { user } = useAuth();
  const { t } = useLang();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [lastSale, setLastSale] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (user) supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => setProfile(data));
  }, [user]);

  const { data: sales = [] } = useQuery({
    queryKey: ["cash-sales-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("cash_sales").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const todayTotal = sales
    .filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const saveSale = async (autoprint = false) => {
    const v = Number(amount);
    if (!v || v <= 0) { toast.error("Enter a valid amount"); return; }
    const { data, error } = await supabase
      .from("cash_sales")
      .insert({ user_id: user!.id, amount: v, operator_name: profile?.full_name ?? user!.email })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setLastSale(data);
    setAmount("");
    toast.success(`${t("saved")} • ${t("slipNo")}${data.slip_number}`);
    qc.invalidateQueries({ queryKey: ["cash-sales-recent"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    inputRef.current?.focus();
    if (autoprint) setTimeout(() => window.print(), 200);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); saveSale(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{t("cashCounter")}</h1>
        <p className="text-muted-foreground mt-1">{t("todayCash")}: <span className="font-bold text-foreground">{fmtMoney(todayTotal)}</span></p>
      </div>

      <Card className="p-6 md:p-10 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
        <label className="block text-sm font-semibold opacity-90 mb-3">{t("enterAmount")}</label>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="0"
          className="w-full bg-transparent text-5xl md:text-7xl font-black tabular-nums outline-none placeholder:text-primary-foreground/40"
        />
        <p className="text-sm opacity-80 mt-3">{t("pressEnter")}</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Button size="lg" variant="secondary" className="font-bold" onClick={() => saveSale(false)}>
            <Plus className="w-5 h-5 mr-2" /> {t("save")}
          </Button>
          <Button size="lg" variant="secondary" className="font-bold" onClick={() => saveSale(true)}>
            <Printer className="w-5 h-5 mr-2" /> {t("save")} + {t("print")}
          </Button>
        </div>
      </Card>

      {lastSale && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Receipt className="w-5 h-5" /> {t("invoice")} {t("slipNo")}{lastSale.slip_number}</h3>
            <Button onClick={() => window.print()} variant="outline" size="sm"><Printer className="w-4 h-4 mr-2" />{t("print")}</Button>
          </div>
          <InvoicePrint sale={lastSale} profile={profile} />
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-bold mb-4">{t("recentSales")}</h3>
        <div className="space-y-2">
          {sales.length === 0 && <p className="text-muted-foreground text-sm">{t("noData")}</p>}
          {sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-semibold">{t("slipNo")}{s.slip_number}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(s.created_at)}</p>
              </div>
              <p className="text-lg font-bold stat-number">{fmtMoney(s.amount)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
