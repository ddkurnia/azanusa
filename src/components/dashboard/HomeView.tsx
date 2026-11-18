"use client";

import { useMemo } from "react";
import { BellOff, Info } from "lucide-react";
import { useSchedule } from "@/hooks/use-schedule";
import { useNow } from "@/hooks/use-now";
import { useAppStore } from "@/lib/store";
import { NextPrayerHero, nextPrayerOf } from "./NextPrayerHero";
import { PrayerTimesList } from "./PrayerTimesList";
import { QuickAccessGrid } from "./QuickAccessGrid";
import { SourceBadge } from "./SourceBadge";
import type { ViewKey } from "@/hooks/use-hash-route";

export function HomeView({ navigate }: { navigate: (v: ViewKey) => void }) {
  const { schedule, tomorrow, loading, error, fromCache } = useSchedule();
  const now = useNow(1000);
  const notifications = useAppStore((s) => s.notifications);
  const next = useMemo(() => nextPrayerOf(schedule, tomorrow, now), [schedule, tomorrow, now]);
  const allOff = Object.values(notifications).every((n) => n.mode === "off");

  if (!schedule) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold">Jadwal gagal dimuat</p>
            <p className="mt-1 leading-relaxed opacity-90">{error}</p>
            <p className="mt-2 text-xs opacity-70">
              Periksa koneksi internet Anda, lalu buka halaman ini lagi.
            </p>
          </div>
        )}
        {loading && !error && <SkeletonHero />}
        <SkeletonList />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allOff && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            Semua pengingat salat sedang nonaktif. Nyalakan di{" "}
            <button onClick={() => navigate("pengaturan")} className="font-semibold text-primary underline">
              Pengaturan
            </button>{" "}
            agar tidak terlewat.
          </span>
        </div>
      )}
      <NextPrayerHero schedule={schedule} tomorrow={tomorrow} next={next} />
      <PrayerTimesList schedule={schedule} nextKey={next?.tomorrow ? undefined : next?.key} />
      <SourceBadge schedule={schedule} fromCache={fromCache} />
      <QuickAccessGrid navigate={navigate} />
      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Hitung mundur mengikuti zona waktu wilayah yang dipilih, bukan perangkat.
        Pengingat aktif selama aplikasi terbuka — lihat keterbatasan di Pengaturan.
      </p>
    </div>
  );
}

function SkeletonHero() {
  return (
    <div className="animate-pulse rounded-2xl bg-teal-mid/90 p-5">
      <div className="h-4 w-24 rounded bg-white/20" />
      <div className="mt-2 h-8 w-40 rounded bg-white/25" />
      <div className="mx-auto mt-6 h-12 w-44 rounded bg-white/25" />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-3">
          <div className="h-9 w-9 rounded-xl bg-muted" />
          <div className="h-3.5 flex-1 rounded bg-muted" />
          <div className="h-5 w-14 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
