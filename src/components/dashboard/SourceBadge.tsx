"use client";

import { useMemo } from "react";
import { BadgeCheck, Clock3, ShieldAlert, RefreshCw } from "lucide-react";
import type { PrayerSchedule } from "@/types";

export function SourceBadge({
  schedule,
  fromCache,
  onRetry,
  retrying,
}: {
  schedule: PrayerSchedule | null;
  fromCache: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const syncedLabel = useMemo(() => {
    if (!schedule) return "";
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(schedule.syncedAt));
  }, [schedule]);

  if (!schedule) return null;
  const src = schedule.source;
  const ok = src.official && src.verified;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${
        ok
          ? "border-emerald-200 bg-emerald-soft text-primary"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {ok ? (
        <BadgeCheck className="h-4 w-4 shrink-0" />
      ) : (
        <ShieldAlert className="h-4 w-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">{src.label}</span>
        {fromCache ? " (cache perangkat)" : ""}
        {". "}
        <span className="opacity-80">{src.note}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 opacity-80">
        <Clock3 className="h-3 w-3" />
        {syncedLabel}
      </span>
      {onRetry ? (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-current/30 px-2 py-1 font-semibold hover:bg-white/40 disabled:opacity-50"
          aria-label="Muat ulang jadwal"
        >
          <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
          Muat ulang
        </button>
      ) : null}
    </div>
  );
}
