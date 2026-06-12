import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { fmtMoney, todayISO } from "@/lib/format";
import { Banknote, Users, CalendarDays, TrendingUp, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { t, dir } = useLang();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = todayISO();
      const startOfDay = new Date(today + "T00:00:00").toISOString();

      const [cashRes, udharRes, clientsRes, profileRes] = await Promise.all([
        supabase.from("cash_sales").select("amount").gte("created_at", startOfDay),
        supabase.from("udhar_entries").select("entry_type, amount"),
        supabase.from("monthly_clients").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("shop_name, full_name").eq("id", user!.id).single(),
      ]);

      const cashToday = (cashRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const totalCredit = (udharRes.data ?? []).filter(r => r.entry_type === "credit").reduce((s, r) => s + Number(r.amount), 0);
      const totalPayments = (udharRes.data ?? []).filter(r => r.entry_type === "payment").reduce((s, r) => s + Number(r.amount), 0);
      const outstanding = totalCredit - totalPayments;

      return {
        cashToday,
        outstanding,
        monthlyClients: clientsRes.count ?? 0,
        shopName: profileRes.data?.shop_name ?? "Shop",
        fullName: profileRes.data?.full_name ?? "",
      };
    },
  });

  const cards = [
    { key: "todayCash", value: fmtMoney(stats?.cashToday ?? 0), icon: Banknote, color: "from-primary to-primary/70", to: "/cash-counter" },
    { key: "outstandingUdhar", value: fmtMoney(stats?.outstanding ?? 0), icon: Users, color: "from-destructive to-destructive/70", to: "/udhar" },
    { key: "activeMonthlyClients", value: String(stats?.monthlyClients ?? 0), icon: CalendarDays, color: "from-accent to-accent/70", to: "/monthly" },
    { key: "reports", value: t("thisMonth"), icon: TrendingUp, color: "from-success to-success/70", to: "/reports" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{t("welcomeBack")}</p>
        <h1 className="text-3xl md:text-4xl font-black">{stats?.shopName ?? t("dashboard")}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.key} to={c.to} className="group">
              <Card className={`p-5 bg-gradient-to-br ${c.color} text-primary-foreground border-0 hover:scale-[1.02] transition-transform`}>
                <div className="flex items-start justify-between">
                  <Icon className="w-6 h-6 opacity-80" />
                  <ArrowRight className={`w-5 h-5 opacity-0 group-hover:opacity-80 transition ${dir === "rtl" ? "rotate-180" : ""}`} />
                </div>
                <p className="text-sm opacity-90 mt-4">{t(c.key as any)}</p>
                <p className="text-2xl md:text-3xl font-black stat-number mt-1">{c.value}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/cash-counter">
          <Card className="p-8 hover:border-primary transition cursor-pointer">
            <Banknote className="w-10 h-10 text-primary mb-3" />
            <h3 className="text-xl font-bold">{t("newSale")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t("pressEnter")}</p>
          </Card>
        </Link>
        <Link to="/udhar">
          <Card className="p-8 hover:border-primary transition cursor-pointer">
            <Users className="w-10 h-10 text-accent mb-3" />
            <h3 className="text-xl font-bold">{t("udhar")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t("addCredit")} • {t("receivePayment")}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
