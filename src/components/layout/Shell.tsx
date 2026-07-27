import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Milk, LogOut, Globe, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { SyncStatusPill } from "@/components/SyncStatusPill";

export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t, lang, setLang, dir } = useLang();
  return (
    <div className="min-h-screen flex flex-col bg-background app-chrome" dir={dir}>
      <header className="h-16 border-b bg-card flex items-center px-4 md:px-6 gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-black text-lg">
          <span className="w-9 h-9 grid place-items-center rounded-lg bg-primary text-primary-foreground"><Milk className="w-5 h-5" /></span>
          <span className="hidden sm:inline">{t("appName")}</span>
        </Link>
        <div className="flex-1" />
        <SyncStatusPill />
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="w-4 h-4" /> {user?.username}
        </div>
        <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "ur" : "en")}>
          <Globe className="w-4 h-4 mr-1" /> {lang === "en" ? "اردو" : "EN"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut className="w-4 h-4 mr-1" /> {t("signOut")}
        </Button>
      </header>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
