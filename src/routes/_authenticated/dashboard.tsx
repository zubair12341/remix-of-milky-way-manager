import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Banknote, Users, CalendarDays, FileBarChart, Settings as SettingsIcon, Milk, Truck, ListChecks } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const tiles = [
  { to: "/cash-counter", key: "cashCounter", icon: Banknote, color: "from-primary to-primary/70" },
  { to: "/udhar", key: "udhar", icon: Users, color: "from-accent to-accent/70" },
  { to: "/monthly", key: "monthlyClients", icon: CalendarDays, color: "from-success to-success/70" },
  { to: "/monthly/deliveries", key: "dailyDeliveries", icon: ListChecks, color: "from-success to-success/70" },
  { to: "/purchases", key: "purchases", icon: Truck, color: "from-warning to-warning/70" },
  { to: "/reports", key: "reports", icon: FileBarChart, color: "from-warning to-warning/70" },
  { to: "/reports/summary", key: "summaryReport", icon: FileBarChart, color: "from-primary to-primary/70" },
  { to: "/settings", key: "settings", icon: SettingsIcon, color: "from-foreground/80 to-foreground/60" },
] as const;

function Dashboard() {
  const { t } = useLang();
  const { user } = useAuth();
  const [shopName, setShopName] = useState("Milk Shop");
  const [logo, setLogo] = useState("");

  useEffect(() => {
    api().settings.getAll().then(s => { setShopName(s.shop_name || "Milk Shop"); setLogo(s.logo_data_url || ""); });
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        {logo
          ? <img src={logo} alt="logo" className="h-24 mx-auto object-contain mb-3" />
          : <div className="w-20 h-20 mx-auto rounded-2xl bg-primary text-primary-foreground grid place-items-center mb-3"><Milk className="w-10 h-10" /></div>}
        <h1 className="text-4xl md:text-5xl font-black">{shopName}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{t("welcomeBack")}, {user?.username}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <Link key={tile.to} to={tile.to} className={`group block rounded-2xl bg-gradient-to-br ${tile.color} text-primary-foreground p-6 min-h-[150px] shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95`}>
              <Icon className="w-10 h-10 mb-3 opacity-90" />
              <p className="text-xl md:text-2xl font-black">{t(tile.key as any)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
