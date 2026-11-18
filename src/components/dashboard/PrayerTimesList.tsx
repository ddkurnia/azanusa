"use client";

import { Bell, BellOff, MoonStar, Sunrise, Sun, CloudSun, Sunset, Moon } from "lucide-react";
import type { PrayerKey, PrayerSchedule } from "@/types";
import { PRAYER_NAMES } from "@/types";
import { useAppStore } from "@/lib/store";

const ICONS: Record<string, typeof Sun> = {
  subuh: MoonStar,
  terbit: Sunrise,
  zuhur: Sun,
  asar: CloudSun,
  magrib: Sunset,
  isya: Moon,
};

export function PrayerTimesList({
  schedule,
  nextKey,
}: {
  schedule: PrayerSchedule;
  nextKey?: PrayerKey;
}) {
  const notifications = useAppStore((s) => s.notifications);
  const tzLabel =
    schedule.timezone === "Asia/Jakarta" ? "WIB" : schedule.timezone === "Asia/Makassar" ? "WITA" : "WIT";

  return (
    <section className="animate-fade-up rounded-2xl border border-border bg-card p-2 shadow-sm">
      <header className="flex items-center justify-between px-3 pt-2 pb-1">
        <h3 className="text-sm font-bold text-teal-deep">Jadwal Salat — {schedule.date}</h3>
        <span className="text-[11px] font-semibold text-muted-foreground">{tzLabel}</span>
      </header>
      <ul className="divide-y divide-border/70">
        {schedule.extras
          .filter((e) => e.key === "terbit")
          .map((e) => {
            const Icon = ICONS[e.key] ?? Sunrise;
            return (
              <li key={`extra-${e.key}`} className="flex items-center gap-3 px-3 py-2 text-muted-foreground">
                <Icon className="h-4.5 w-4.5" />
                <span className="flex-1 text-sm">Terbit</span>
                <span className="font-num-tabular text-sm font-semibold">{e.display}</span>
              </li>
            );
          })}
        {schedule.times.map((t) => {
          const Icon = ICONS[t.key] ?? Sun;
          const isNext = t.key === nextKey;
          const notif = notifications[t.key];
          const notifOn = notif && notif.mode !== "off";
          return (
            <li
              key={t.key}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                isNext ? "bg-emerald-soft" : ""
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  isNext ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1">
                <span
                  className={`block text-sm font-semibold ${isNext ? "text-primary" : "text-foreground"}`}
                >
                  {PRAYER_NAMES[t.key]}
                </span>
                {isNext && <span className="block text-[10px] font-medium text-primary">Salat berikutnya</span>}
              </span>
              <span
                className={`font-num-tabular text-base font-bold ${isNext ? "text-primary" : "text-teal-deep"}`}
              >
                {t.display}
              </span>
              <span
                title={notifOn ? `Notifikasi: ${notif.mode}` : "Notifikasi nonaktif"}
                className={`rounded-lg p-1.5 ${notifOn ? "text-primary" : "text-muted-foreground/50"}`}
                aria-label={notifOn ? "Notifikasi aktif" : "Notifikasi nonaktif"}
              >
                {notifOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
