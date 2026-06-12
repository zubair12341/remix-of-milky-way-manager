import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Milk, Globe } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, user, loading } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) toast.error(error); else navigate({ to: "/dashboard" });
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) toast.error(error);
        else toast.success("Account created! You can sign in now.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "ur" : "en")}>
            <Globe className="w-4 h-4 mr-2" /> {lang === "en" ? "اردو" : "English"}
          </Button>
        </div>
        <Card className="p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-3">
              <Milk className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black">{t("appName")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("tagline")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label>{t("fullName")}</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={100} />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label>{t("password")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={busy}>
              {busy ? t("loading") : mode === "signin" ? t("signIn") : t("createAccount")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {mode === "signin" ? (
              <>{t("noAccount")}{" "}
                <button className="text-primary font-semibold" onClick={() => setMode("signup")}>{t("signUp")}</button>
              </>
            ) : (
              <>{t("haveAccount")}{" "}
                <button className="text-primary font-semibold" onClick={() => setMode("signin")}>{t("signIn")}</button>
              </>
            )}
          </div>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/dashboard" className="hover:text-foreground">→ {t("dashboard")}</Link>
        </p>
      </div>
    </div>
  );
}
