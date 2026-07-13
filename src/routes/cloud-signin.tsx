import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Cloud, ArrowLeft } from "lucide-react";
import { cloudSession, cloudSignIn, cloudSignUp } from "@/lib/cloud";

export const Route = createFileRoute("/cloud-signin")({ ssr: false, component: Page });

function Page() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cloudSession().then(s => { if (s) navigate({ to: "/settings" }); });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = mode === "signin"
      ? await cloudSignIn(email.trim(), password)
      : await cloudSignUp(email.trim(), password);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if (mode === "signup") toast.success("Check your email to confirm, then sign in.");
    else { toast.success("Signed in to cloud"); navigate({ to: "/settings" }); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground mb-3"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Settings</Link>
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary text-primary-foreground grid place-items-center mb-3"><Cloud className="w-8 h-8" /></div>
            <h1 className="text-2xl font-black">Cloud Sync</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Sign in to sync across devices" : "Create a cloud account"}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2"><Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full h-12 font-bold" disabled={busy}>
              {busy ? "Please wait…" : (mode === "signin" ? "Sign in" : "Create account")}
            </Button>
          </form>

          <p className="text-center text-sm mt-4">
            {mode === "signin" ? (
              <>New here? <button className="text-primary font-semibold" onClick={() => setMode("signup")}>Create account</button></>
            ) : (
              <>Already have an account? <button className="text-primary font-semibold" onClick={() => setMode("signin")}>Sign in</button></>
            )}
          </p>
          <p className="text-xs text-center text-muted-foreground mt-6">
            Cloud sync is optional. Your app keeps working offline either way.
          </p>
        </Card>
      </div>
    </div>
  );
}
