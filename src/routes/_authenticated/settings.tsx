import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { api, isElectron, type PrinterInfo } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { BackButton } from "@/components/BackButton";
import { Store, Lock, Printer as PrinterIcon, Database, AlertTriangle, Cloud, LogOut, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { syncNow, subscribe as subscribeSync, startSync, type SyncStatus } from "@/lib/sync";
import { cloudSession, cloudSignOut, listBusinesses, createBusiness, pairBusiness, getPairing, type CloudPairing } from "@/lib/cloud";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

function Settings() {
  const { t, lang, setLang } = useLang();
  const { user, refresh } = useAuth();
  const [shop, setShop] = useState({ shop_name: "", logo_data_url: "", printer_name: "", receipt_width: "80" });
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [cur, setCur] = useState(""); const [newU, setNewU] = useState(""); const [newP, setNewP] = useState("");
  const [clearPwd, setClearPwd] = useState("");
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [pairing, setPairingState] = useState<CloudPairing | null>(null);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [newBiz, setNewBiz] = useState("");
  const [syncState, setSyncState] = useState<SyncStatus | null>(null);

  const refreshCloud = async () => {
    const s = await cloudSession();
    setCloudEmail(s?.user?.email ?? null);
    setPairingState(getPairing());
    if (s) { try { setBusinesses(await listBusinesses()); } catch { setBusinesses([]); } }
    else setBusinesses([]);
  };

  useEffect(() => {
    api().settings.getAll().then(s => setShop({ shop_name: s.shop_name || "", logo_data_url: s.logo_data_url || "", printer_name: s.printer_name || "", receipt_width: s.receipt_width || "80" }));
    api().settings.getPrinters().then(setPrinters);
    refreshCloud();
    const unsub = subscribeSync(setSyncState);
    startSync();
    return () => { unsub(); };
  }, []);

  const doCreateBusiness = async () => {
    if (!newBiz.trim()) return toast.error("Business name required");
    try { const b = await createBusiness(newBiz.trim()); await pairBusiness(b.id, b.name); setNewBiz(""); await refreshCloud(); toast.success("Business created and paired"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const doPair = async (id: string, name: string) => {
    try { await pairBusiness(id, name); await refreshCloud(); toast.success("Paired with " + name); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const doSignOutCloud = async () => { await cloudSignOut(); await refreshCloud(); toast.success("Signed out of cloud"); };

  const saveShop = async () => {
    await api().settings.set("shop_name", shop.shop_name);
    await api().settings.set("logo_data_url", shop.logo_data_url);
    await api().settings.set("printer_name", shop.printer_name);
    await api().settings.set("receipt_width", shop.receipt_width);
    toast.success(t("saved"));
  };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setShop(s => ({ ...s, logo_data_url: String(r.result) }));
    r.readAsDataURL(f);
  };

  const changeCreds = async () => {
    if (!cur) return toast.error("Current password required");
    const r = await api().auth.change(cur, newU.trim(), newP);
    if (!r.ok) return toast.error(r.error || "Failed");
    setCur(""); setNewU(""); setNewP("");
    await refresh();
    toast.success(t("saved"));
  };

  const testPrint = async () => {
    await api().settings.set("printer_name", shop.printer_name);
    const r = await api().print.test();
    if (r.ok) toast.success("Sent to printer"); else toast.error(r.error || "Failed");
  };

  const clearAll = async () => {
    if (!confirm(t("clearWarning"))) return;
    if (!clearPwd) return toast.error("Password required");
    const r = await api().data.clearAll(clearPwd);
    if (!r.ok) return toast.error(r.error || "Failed");
    setClearPwd("");
    toast.success("All data cleared");
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <BackButton />
      <h1 className="text-3xl md:text-4xl font-black">{t("settings")}</h1>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2"><Store className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">{t("shopInformation")}</h2></div>
        <div><Label>{t("shopName")}</Label><Input value={shop.shop_name} onChange={(e) => setShop({ ...shop, shop_name: e.target.value })} maxLength={100} /></div>
        <div>
          <Label>{t("shopLogo")}</Label>
          {shop.logo_data_url && <img src={shop.logo_data_url} alt="logo" className="h-20 object-contain my-2" />}
          <Input type="file" accept="image/*" onChange={onLogo} />
        </div>
        <Button onClick={saveShop} className="font-bold">{t("save")}</Button>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">{t("security")}</h2></div>
        <p className="text-sm text-muted-foreground">{t("loggedInAs")}: <span className="font-bold">{user?.username}</span></p>
        <div><Label>{t("currentPassword")}</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label>{t("newUsername")}</Label><Input value={newU} onChange={(e) => setNewU(e.target.value)} placeholder={user?.username} /></div>
          <div><Label>{t("newPassword")}</Label><Input type="password" value={newP} onChange={(e) => setNewP(e.target.value)} /></div>
        </div>
        <Button onClick={changeCreds}>{t("save")}</Button>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2"><PrinterIcon className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">{t("printerSettings")}</h2></div>
        {!isElectron() && <p className="text-xs text-warning-foreground bg-warning/20 border border-warning/30 rounded p-2">{t("desktopOnly")}</p>}
        <div>
          <Label>{t("selectPrinter")}</Label>
          <select className="w-full h-10 rounded-md border border-input px-3 bg-background" value={shop.printer_name} onChange={(e) => setShop({ ...shop, printer_name: e.target.value })}>
            <option value="">{t("systemDefault")}</option>
            {printers.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? " (default)" : ""}</option>)}
          </select>
        </div>
        <div>
          <Label>{t("receiptWidth")}</Label>
          <select className="w-full h-10 rounded-md border border-input px-3 bg-background" value={shop.receipt_width} onChange={(e) => setShop({ ...shop, receipt_width: e.target.value })}>
            <option value="58">58mm</option>
            <option value="80">80mm</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveShop}>{t("save")}</Button>
          <Button variant="outline" onClick={testPrint}>{t("testPrint")}</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-bold">{t("language")}</h2>
        <div className="flex gap-2">
          <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>English</Button>
          <Button variant={lang === "ur" ? "default" : "outline"} onClick={() => setLang("ur")}>اردو</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">{t("dataManagement")}</h2></div>
        {!isElectron() && <p className="text-xs text-warning-foreground bg-warning/20 border border-warning/30 rounded p-2">{t("desktopOnly")}</p>}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={async () => { const r = await api().data.backup(); if (r.ok) toast.success("Backup downloaded"); }}>{t("backupDb")}</Button>
          <Button variant="outline" onClick={async () => { const r = await api().data.restore(); if (r.ok) toast.success("Restored. Restarting…"); }}>{t("restoreDb")}</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2"><Cloud className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">Cloud Sync (optional)</h2></div>
        {!cloudEmail ? (
          <>
            <p className="text-sm text-muted-foreground">Sign in to sync your data across devices. Your app keeps working offline either way.</p>
            <Link to="/cloud-signin"><Button><Cloud className="w-4 h-4 mr-2" /> Enable Cloud Sync</Button></Link>
          </>
        ) : (
          <>
            <p className="text-sm">Signed in as <span className="font-bold">{cloudEmail}</span></p>
            {pairing?.business_id ? (
              <p className="text-sm text-success">Paired with business: <span className="font-bold">{pairing.business_name}</span></p>
            ) : (
              <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                <p className="text-sm font-semibold">Pair this device with a business</p>
                {businesses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Existing businesses</Label>
                    {businesses.map(b => (
                      <div key={b.id} className="flex items-center justify-between border rounded p-2">
                        <span>{b.name}</span>
                        <Button size="sm" onClick={() => doPair(b.id, b.name)}>Pair</Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Or create a new business</Label>
                  <div className="flex gap-2">
                    <Input value={newBiz} onChange={(e) => setNewBiz(e.target.value)} placeholder="e.g. Ali Milk Shop" />
                    <Button onClick={doCreateBusiness}>Create</Button>
                  </div>
                </div>
              </div>
            )}
            {pairing?.business_id && (
              <div className="border rounded-md p-3 bg-muted/20 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Sync status</span>
                  <Button size="sm" variant="outline" onClick={() => syncNow()} disabled={syncState?.running}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${syncState?.running ? "animate-spin" : ""}`} /> Sync now
                  </Button>
                </div>
                <div>Network: <span className={syncState?.online ? "text-success font-semibold" : "text-destructive font-semibold"}>{syncState?.online ? "Online" : "Offline"}</span></div>
                <div>Pending changes: <span className="font-semibold">{syncState?.pending ?? 0}</span></div>
                <div>Last push: <span className="font-mono text-xs">{syncState?.lastPushAt ? new Date(syncState.lastPushAt).toLocaleString() : "—"}</span></div>
                <div>Last pull: <span className="font-mono text-xs">{syncState?.lastPullAt ? new Date(syncState.lastPullAt).toLocaleString() : "—"}</span></div>
                {syncState?.lastError && <div className="text-destructive">Error: {syncState.lastError}</div>}
                {!!syncState?.failed && (
                  <div className="border border-destructive/40 rounded p-2 space-y-2">
                    <div className="text-destructive font-semibold">{syncState.failed} record(s) could not be synced and were set aside.</div>
                    {failures.map(f => (
                      <div key={f.id} className="text-xs text-muted-foreground">{f.table}: {f.reason}</div>
                    ))}
                    <Button size="sm" variant="outline" onClick={async () => { await clearSyncFailures(); setFailures([]); }}>Dismiss</Button>
                  </div>
                )}

              </div>
            )}
            <Button variant="outline" onClick={doSignOutCloud}><LogOut className="w-4 h-4 mr-2" /> Sign out of cloud</Button>
          </>
        )}
      </Card>

      <Card className="p-6 space-y-3 border-destructive/40">
        <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /><h2 className="text-xl font-bold">{t("dangerZone")}</h2></div>
        <p className="text-sm text-muted-foreground">{t("clearWarning")}</p>
        <div><Label>{t("currentPassword")}</Label><Input type="password" value={clearPwd} onChange={(e) => setClearPwd(e.target.value)} /></div>
        <Button variant="destructive" onClick={clearAll}>{t("clearAllData")}</Button>
      </Card>
    </div>
  );
}
