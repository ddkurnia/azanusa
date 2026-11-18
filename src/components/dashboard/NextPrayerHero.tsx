"use client";

import { useMemo } from "react";
import { MoonStar, Sunrise, Sun, CloudSun, Sunset, Moon, Play, Pause, MapPin, Volume2 } from "lucide-react";
import type { PrayerKey, PrayerSchedule } from "@/types";
import { PRAYER_NAMES } from "@/types";
import { clockInTz, longDateInTz } from "@/lib/timezone";
import { formatHijri, hijriDateInTz } from "@/lib/hijri";
import { azanPlayer } from "@/lib/audio/azan";
import { useNow } from "@/hooks/use-now";

const ICONS: Record<string, typeof Sun> = {
  subuh: MoonStar,
  terbit: Sunrise,
  zuhur: Sun,
  asar: CloudSun,
  magrib: Sunset,
  isya: Moon,
};

export interface NextInfo {
  key: PrayerKey;
  display: string;
  utcISO: string;
  tomorrow: boolean;
}

export function nextPrayerOf(
  schedule: PrayerSchedule | null,
  tomorrow: PrayerSchedule | null,
  now: Date
): NextInfo | null {
  if (!schedule) return null;
  for (const t of schedule.times) {
    if (Date.parse(t.utcISO) > now.getTime()) {
      return { key: t.key, display: t.display, utcISO: t.utcISO, tomorrow: false };
    }
  }
  if (tomorrow) {
    const first = tomorrow.times[0];
    if (first) return { key: first.key, display: first.display, utcISO: first.utcISO, tomorrow: true };
  }
  return null;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function NextPrayerHero({
  schedule,
  tomorrow,
  next,
}: {
  schedule: PrayerSchedule;
  tomorrow: PrayerSchedule | null;
  next: NextInfo | null;
}) {
  const now = useNow(1000);
  const tz = schedule.region.tz;
  const countdown = next ? formatCountdown(Date.parse(next.utcISO) - now.getTime()) : "--:--:--";
  const clock = clockInTz(now, tz);
  const dateLabel = longDateInTz(now, tz);
  const hijri = formatHijri(hijriDateInTz(now, tz));

  const playing = azanPlayer.isPlaying();

  return (
    <section className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-deep via-teal-mid to-emerald-az p-5 text-white shadow-md">
      <div className="pattern-islamic pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-white/75">
              {next?.tomorrow ? "Besok" : "Salat berikutnya"}
            </p>
            <h2 className="mt-0.5 text-2xl font-extrabold tracking-wide text-shadow-soft">
              {next ? PRAYER_NAMES[next.key] : "—"}
            </h2>
            <p className="mt-0.5 text-sm text-white/85">
              {next ? `${next.display} ${tz === "Asia/Jakarta" ? "WIB" : tz === "Asia/Makassar" ? "WITA" : "WIT"}` : "Jadwal belum tersedia"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-num-tabular text-xl font-bold">{clock}</p>
            <p className="mt-0.5 text-[10px] text-white/70">{hijri}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <p className="text-[11px] uppercase tracking-widest text-gold-soft">Hitung mundur azan</p>
          <p className="font-num-tabular mt-1 text-5xl font-extrabold tracking-tight text-shadow-soft" aria-live="off">
            {countdown}
          </p>
          <p className="mt-1 text-[11px] text-white/70">{dateLabel}</p>
        </div>

        {next && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                if (azanPlayer.isUnlocked() && azanPlayer.isPlaying()) azanPlayer.pause();
                else azanPlayer.playAzan();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-teal-deep shadow transition hover:brightness-105"
              aria-label={playing ? "Jeda azan" : "Putar azan"}
              title={
                azanPlayer.isUnlocked()
                  ? "Putar/jeda audio azan"
                  : "Aktifkan audio di Pengaturan > Audio terlebih dahulu"
              }
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Jeda Azan" : "Putar Azan"}
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-white/60">
          <MapPin className="h-3 w-3" />
          {schedule.region.name}, {schedule.region.prov}
        </div>
      </div>
    </section>
  );
}
