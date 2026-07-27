// Visible sync status pill. Reflects: offline, unpaired, pending outbox
// count, active sync, last error, and IndexedDB persistence state. Clicking
// runs a manual sync now.
import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, WifiOff, ShieldAlert } from "lucide-react";
import { subscribe, syncNow, getStatus, type SyncStatus } from "@/lib/sync-engine";

export function SyncStatusPill() {
  const [s, setS] = useState<SyncStatus>(getStatus());
  useEffect(() => { const unsub = subscribe(setS); return () => { unsub(); }; }, []);

  let Icon = Cloud;
  let label = "Synced";
  let cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let title = s.lastPushAt || s.lastPullAt ? `Last sync: ${new Date(s.lastPushAt ?? s.lastPullAt!).toLocaleString()}` : "All local — synced";

  if (!s.online) {
    Icon = WifiOff;
    label = s.pending > 0 ? `Offline · ${s.pending} pending` : "Offline";
    cls = "bg-slate-100 text-slate-700 border-slate-200";
    title = "You're offline. Changes stay on this device and sync when you reconnect.";
  } else if (!s.paired) {
    Icon = CloudOff;
    label = s.pending > 0 ? `Not linked · ${s.pending} pending` : "Not linked";
    cls = "bg-amber-50 text-amber-800 border-amber-200";
    title = "Cloud sync not linked. Open Settings → Cloud Sign-in to link this device to your shop.";
  } else if (s.running) {
    Icon = RefreshCw;
    label = "Syncing…";
    cls = "bg-sky-50 text-sky-700 border-sky-200";
    title = "Syncing with the cloud.";
  } else if (s.lastError) {
    Icon = AlertTriangle;
    label = "Sync error";
    cls = "bg-red-50 text-red-700 border-red-200";
    title = `${s.lastError} — click to retry.`;
  } else if (s.pending > 0) {
    Icon = RefreshCw;
    label = `${s.pending} pending`;
    cls = "bg-sky-50 text-sky-700 border-sky-200";
    title = "Draining outbox to the cloud…";
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void syncNow()}
        title={title}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls} hover:opacity-90`}
      >
        <Icon className={`h-3.5 w-3.5 ${s.running ? "animate-spin" : ""}`} />
        <span>{label}</span>
      </button>
      {s.persist === "denied" && (
        <span
          title="The browser did NOT grant persistent storage. Your local data can be cleared automatically if the device runs low on space. Install the app (Add to Home Screen) to strengthen persistence."
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800"
        >
          <ShieldAlert className="h-3 w-3" /> storage at risk
        </span>
      )}
    </div>
  );
}
