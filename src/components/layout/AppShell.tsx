import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Banknote, Users, CalendarDays, FileBarChart, Settings as SettingsIcon, Milk, Globe, LogOut, Menu, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { to: "/cash-counter", labelKey: "cashCounter", icon: Banknote },
  { to: "/udhar", labelKey: "udhar", icon: Users },
  { to: "/monthly", labelKey: "monthlyClients", icon: CalendarDays },
  { to: "/reports", labelKey: "reports", icon: FileBarChart },
  { to: "/settings", labelKey: "settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, dir } = useLang();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background" dir={dir}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform",
        dir === "rtl" ? "right-0" : "left-0",
        open ? "translate-x-0" : dir === "rtl" ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0",
      )}>
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
            <Milk className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{t("appName")}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{t("tagline")}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{t(item.labelKey as any)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"
          >
            <LogOut className="w-5 h-5" />
            <span>{t("signOut")}</span>
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className={cn("flex-1 flex flex-col min-w-0", dir === "rtl" ? "md:mr-64" : "md:ml-64")}>
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b h-16 flex items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "ur" : "en")}>
            <Globe className="w-4 h-4 mr-2" /> {lang === "en" ? "اردو" : "English"}
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
