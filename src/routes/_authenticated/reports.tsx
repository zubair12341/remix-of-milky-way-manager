import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { fmtMoney, fmtDate } from "@/lib/format";
import { BackButton } from "@/components/BackButton";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

function Reports() {
  const { t } = useLang();
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);

  const { data: range = [] } = useQuery({ queryKey: ["cash-range", from, to], queryFn: () => api().cash.range(from, to) });
  const { data: all = [] } = useQuery({ queryKey: ["cash-recent-all"], queryFn: () => api().cash.recent(100) });
  const { data: purchaseTotals } = useQuery({ queryKey: ["purchase-totals"], queryFn: () => api().purchases.totals() });

  // Fill missing days
  const days: { day: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const hit = range.find(r => r.day === d);
    days.push({ day: d.slice(5), total: hit?.total ?? 0 });
  }
  const total = range.reduce((a, r) => a + r.total, 0);

  const exportCsv = () => {
    const rows = [["Invoice", "Amount", "Date"], ...all.map(s => [s.invoice_no, s.amount, s.created_at])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cash-sales-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl md:text-4xl font-black">{t("reports")}</h1>
        <button onClick={exportCsv} className="px-4 py-2 rounded bg-primary text-primary-foreground font-bold">{t("exportCsv")}</button>
      </div>

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{t("last14Days")} • {t("cashSales")}</p>
        <p className="text-4xl font-black tabular-nums mt-1">{fmtMoney(total)}</p>
        <div className="h-64 mt-4">
          <ResponsiveContainer>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {purchaseTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("todayPurchase")}</p>
            <p className="text-2xl font-black tabular-nums text-warning mt-1">{fmtMoney(purchaseTotals.today)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("monthPurchase")} • {t("purchases")}</p>
            <p className="text-2xl font-black tabular-nums text-warning mt-1">{fmtMoney(purchaseTotals.month)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("profitLast14")}</p>
            <p className={`text-2xl font-black tabular-nums mt-1 ${total - purchaseTotals.month >= 0 ? "text-success" : "text-destructive"}`}>
              {fmtMoney(total - purchaseTotals.month)}
            </p>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h3 className="font-black text-lg mb-3">{t("recentSales")}</h3>
        <div className="divide-y max-h-96 overflow-y-auto">
          {all.map(s => (
            <div key={s.id} className="flex justify-between py-2">
              <span>#{s.invoice_no} • {fmtDate(s.created_at)}</span>
              <span className="font-bold tabular-nums">{fmtMoney(s.amount)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
