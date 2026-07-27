// Small visible status pill so the shop owner always knows the state of
// their data — required by the offline-first PWA plan. Backed by the
// existing src/lib/sync.ts subscribe() model (pull-only today; push-sync
// is scaffolded but not yet enabled, and this pill reflects that honestly).
import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, WifiOff } from "lucide-react";
import { subscribe, syncNow, type SyncStatus } from "@/lib/sync";
import { getPairing } from "@/lib/cloud";

export function SyncStatusPill() {
  const [s, setS] = useState<SyncStatus>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    paired: false,
    lastPullAt: null,
    lastError: null,
    running: false,
  });
  const [paired, setPaired] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribe(setS);
    setPaired(!!getPairing()?.business_id);
    const onStorage = () => setPaired(!!getPairing()?.business_id);
    window.addEventListener("storage", onStorage);
    return () => { unsub(); window.removeEventListener("storage", onStorage); };
  }, []);

  let icon = <Cloud className="h-3.5 w-3.5" />;
  let label = "Synced";
  let cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let title = s.lastPullAt ? `Last sync: ${new Date(s.lastPullAt).toLocaleString()}` : "All local — synced";

  if (!s.online) {
    icon = <WifiOff className="h-3.5 w-3.5" />;
    label = "Offline";
    cls = "bg-slate-100 text-slate-700 border-slate-200";
    title = "You're offline. Changes stay on this device and sync when you reconnect.";
  } else if (!paired) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = "Not linked";
    cls = "bg-amber-50 text-amber-800 border-amber-200";
    title = "Cloud sync not linked. Go to Settings → Cloud Sign-in to link this device to your shop.";
  } else if (s.running) {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    label = "Syncing…";
    cls = "bg-sky-50 text-sky-700 border-sky-200";
    title = "Pulling latest changes from the cloud.";
  } else if (s.lastError) {
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
    label = "Sync error";
    cls = "bg-red-50 text-red-700 border-red-200";
    title = `${s.lastError} — click to retry.`;
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls} hover:opacity-90`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
