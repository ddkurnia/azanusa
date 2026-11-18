"use client";

import { useEffect, useState } from "react";
import { WifiOff, X } from "lucide-react";

/** Banner status offline — muncul saat navigator.onLine = false */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline || dismissed) return null;
  return (
    <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Anda sedang offline. Jadwal terakhir yang tersimpan tetap ditampilkan.
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Tutup"
        className="rounded-md p-1 hover:bg-amber-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
