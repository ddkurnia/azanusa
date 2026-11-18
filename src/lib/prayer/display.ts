"use client";

/** Helper tampilan jadwal salat yang dipakai lintas komponen dashboard */

import { MoonStar, Sunrise, Sun, CloudSun, Sunset, Moon } from "lucide-react";
import type { PrayerKey, PrayerSchedule, TimeZoneId } from "@/types";

export const PRAYER_ICONS: Record<string, typeof Sun> = {
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

/** Salat berikutnya dari jadwal hari ini (dengan fallback jadwal besok) */
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

/** Format hitung mundur HH:MM:SS */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Label zona waktu wilayah: WIB/WITA/WIT */
export function tzLabelOf(tz: string): string {
  return tz === "Asia/Jakarta" ? "WIB" : tz === "Asia/Makassar" ? "WITA" : "WIT";
}

export type { TimeZoneId };
