import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Milk, Globe, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ ssr: false, component: LoginPage });

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const { t, lang, setLang, dir } = useLang();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("Milk Shop");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState(false);

  // navigate() intentionally excluded from deps — see _authenticated/route.tsx.
  useEffect(() => {
    api().setup.status().then(st => { if (!st.complete) navigate({ to: "/setup", replace: true }); });
    api().settings.getAll().then(s => { setShopName(s.shop_name || "Milk Shop"); setLogo(s.logo_data_url || ""); });
     
  }, []);

  useEffect(() => { if (!loading && user) navigate({ to: "/dashboard", replace: true }); }, [user, loading]);


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(username.trim(), password);
    setBusy(false);
    if (error) toast.error(error);
    else navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4" dir={dir}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "ur" : "en")}>
            <Globe className="w-4 h-4 mr-2" /> {lang === "en" ? "اردو" : "English"}
          </Button>
        </div>
        <Card className="p-8">
          <div className="text-center mb-6">
            {logo
              ? <img src={logo} alt="logo" className="h-20 mx-auto object-contain mb-3" />
              : <div className="w-20 h-20 mx-auto rounded-2xl bg-primary text-primary-foreground grid place-items-center mb-3"><Milk className="w-10 h-10" /></div>}
            <h1 className="text-2xl font-black">{shopName}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("signIn")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("username")}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label>{t("password")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full h-14 text-lg font-bold" disabled={busy}>
              <LogIn className="w-5 h-5 mr-2" /> {busy ? t("loading") : t("signIn")}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            {t("defaultCreds")}: <code className="font-mono">admin / admin123</code>
          </p>
        </Card>
      </div>
    </div>
  );
}
