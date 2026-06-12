import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Printer, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function Reports() {
  const { user } = useAuth();
  const { t } = useLang();

  const { data } = useQuery({
    queryKey: ["reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date(); start.setDate(start.getDate() - 30);
      const [cash, udhar, bills] = await Promise.all([
        supabase.from("cash_sales").select("amount, created_at").gte("created_at", start.toISOString()),
        supabase.from("udhar_entries").select("amount, entry_type, entry_date").gte("entry_date", start.toISOString().slice(0, 10)),
        supabase.from("monthly_bills").select("total_amount, amount_paid, billing_month"),
      ]);
      return { cash: cash.data ?? [], udhar: udhar.data ?? [], bills: bills.data ?? [] };
    },
  });

  const today = new Date().toDateString();
  const todayCash = (data?.cash ?? []).filter((r) => new Date(r.created_at).toDateString() === today).reduce((s, r) => s + Number(r.amount), 0);
  const todayUdhar = (data?.udhar ?? []).filter((r) => r.entry_type === "credit" && new Date(r.entry_date).toDateString() === today).reduce((s, r) => s + Number(r.amount), 0);
  const todayCollected = (data?.udhar ?? []).filter((r) => r.entry_type === "payment" && new Date(r.entry_date).toDateString() === today).reduce((s, r) => s + Number(r.amount), 0);

  const totalCash = (data?.cash ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalUdhar = (data?.udhar ?? []).filter((r) => r.entry_type === "credit").reduce((s, r) => s + Number(r.amount), 0);
  const totalCollected = (data?.udhar ?? []).filter((r) => r.entry_type === "payment").reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = totalUdhar - totalCollected;

  // Build last 14 days chart
  const days: { day: string; cash: number; udhar: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    days.push({
      day: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      cash: (data?.cash ?? []).filter((r) => new Date(r.created_at).toDateString() === ds).reduce((s, r) => s + Number(r.amount), 0),
      udhar: (data?.udhar ?? []).filter((r) => r.entry_type === "credit" && new Date(r.entry_date).toDateString() === ds).reduce((s, r) => s + Number(r.amount), 0),
    });
  }

  const exportCSV = () => {
    const rows = [["Date", "Cash Sales", "Udhar Sales"]];
    days.forEach((d) => rows.push([d.day, String(d.cash), String(d.udhar)]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "report.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">{t("reports")}</h1>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />{t("print")}</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-bold mb-4">{t("dailyReport")} — {fmtDate(new Date())}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={t("cashSales")} value={fmtMoney(todayCash)} />
          <Stat label={t("udharSales")} value={fmtMoney(todayUdhar)} />
          <Stat label={t("collections")} value={fmtMoney(todayCollected)} />
          <Stat label={t("netAmount")} value={fmtMoney(todayCash + todayCollected)} accent />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold mb-4">{t("weeklyReport")}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="cash" fill="oklch(0.55 0.18 250)" name={t("cashSales")} />
              <Bar dataKey="udhar" fill="oklch(0.72 0.16 165)" name={t("udharSales")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold mb-4">{t("monthlyReport")} (30 days)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={t("cashSales")} value={fmtMoney(totalCash)} />
          <Stat label={t("udharSales")} value={fmtMoney(totalUdhar)} />
          <Stat label={t("collections")} value={fmtMoney(totalCollected)} />
          <Stat label={t("outstandingUdhar")} value={fmtMoney(outstanding)} destructive />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent, destructive }: { label: string; value: string; accent?: boolean; destructive?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${accent ? "bg-primary text-primary-foreground" : destructive ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-black stat-number mt-1">{value}</p>
    </div>
  );
}
