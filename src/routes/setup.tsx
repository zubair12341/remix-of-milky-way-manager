import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Milk, Upload, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({ ssr: false, component: SetupWizard });

function withFallback<T>(promise: Promise<T>, fallback: T, label: string, ms = 2500) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.error(`${label} timed out`);
      resolve(fallback);
    }, ms);
  });

  return Promise.race([promise, timeout]).catch((error) => {
    console.error(`${label} failed`, error);
    return fallback;
  }).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shopName, setShopName] = useState("Milk Shop");
  const [logo, setLogo] = useState("");
  const [printers, setPrinters] = useState<{ name: string; displayName: string }[]>([]);
  const [printer, setPrinter] = useState("");
  const [busy, setBusy] = useState(false);

  // navigate() intentionally excluded from deps — see _authenticated/route.tsx.
  useEffect(() => {
    let cancelled = false;
    void withFallback(api().setup.status(), { complete: false }, "Setup status check").then((st) => {
      if (!cancelled && st.complete) navigate({ to: "/auth", replace: true });
    });
    void withFallback(api().settings.getPrinters(), [], "Printer discovery", 1500).then((list) => {
      if (!cancelled) setPrinters(list);
    });
    return () => { cancelled = true; };
  }, []);

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setLogo(String(r.result || "")); r.readAsDataURL(f);
  };

  const finish = async () => {
    if (!username.trim()) return toast.error("Username is required");
    if (password.length < 4) return toast.error("Password must be at least 4 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const r = await api().setup.complete({ username: username.trim(), password, shop_name: shopName.trim() || "Milk Shop", logo_data_url: logo, printer_name: printer });
    setBusy(false);
    if (!r.ok) return toast.error(r.error || "Setup failed");
    toast.success("Setup complete — please sign in");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 grid place-items-center rounded-2xl bg-primary text-primary-foreground"><Milk className="w-6 h-6" /></span>
          <div>
            <h1 className="text-2xl font-black">Welcome — let's set up your shop</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 3 · Everything stays on this computer.</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold">Administrator account</h2>
            <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={e => setUsername(e.target.value)} autoFocus /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label>Confirm password</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Stored locally with bcrypt — never sent over the internet.</p>
            <Button className="w-full" onClick={() => {
              if (!username.trim()) return toast.error("Username is required");
              if (password.length < 4) return toast.error("Password must be at least 4 characters");
              if (password !== confirm) return toast.error("Passwords do not match");
              setStep(2);
            }}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold">Shop details</h2>
            <div className="space-y-2"><Label>Shop name</Label><Input value={shopName} onChange={e => setShopName(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Shop logo (optional)</Label>
              <div className="flex items-center gap-3">
                {logo ? <img src={logo} alt="logo" className="h-16 w-16 object-contain rounded border" /> : <div className="h-16 w-16 grid place-items-center rounded border bg-muted text-muted-foreground"><Upload className="w-5 h-5" /></div>}
                <Input type="file" accept="image/*" onChange={onLogo} />
              </div>
            </div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button><Button className="flex-1" onClick={() => setStep(3)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold">Default printer</h2>
            <div className="space-y-2">
              <Label>Receipt printer (optional)</Label>
              <select className="w-full h-10 rounded-md border px-3 bg-background" value={printer} onChange={e => setPrinter(e.target.value)}>
                <option value="">— None / choose later —</option>
                {printers.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
              </select>
              {printers.length === 0 && <p className="text-xs text-muted-foreground">No printers detected. You can configure one later in Settings.</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={finish} disabled={busy}><Check className="w-4 h-4 mr-1" /> {busy ? "Saving…" : "Finish setup"}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
