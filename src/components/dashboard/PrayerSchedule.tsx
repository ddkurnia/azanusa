"use client";

/**
 * PrayerSchedule — kartu jadwal lima salat sesuai mockup:
 * ikon, nama, jam, status; baris salat berikutnya di-highlight emas,
 * salat yang sudah lewat bertanda centang hijau, baris lain transparan.
 * Data berasal dari penyedia jadwal nyata (bukan angka contoh).
 */

import { Bell, BellOff, CheckCircle2 } from "lucide-react";
import type { PrayerSchedule } from "@/types";
import { PRAYER_NAMES } from "@/types";
import { useAppStore } from "@/lib/store";
import { PRAYER_ICONS } from "@/lib/prayer/display";

export function PrayerSchedule({
  schedule,
  now,
  nextKey,
}: {
  schedule: PrayerSchedule;
  now: Date;
  nextKey?: string;
}) {
  const notifications = useAppStore((s) => s.notifications);

  return (
    <section className="panel-teal-deep overflow-hidden rounded-2xl shadow-lg shadow-black/25">
      <ul className="divide-y divide-white/10">
        {schedule.times.map((t) => {
          const Icon = PRAYER_ICONS[t.key] ?? Bell;
          const isNext = t.key === nextKey;
          const isPassed = !isNext && Date.parse(t.utcISO) <= now.getTime();
          const notif = notifications[t.key];
          const notifOn = notif && notif.mode !== "off";

          if (isNext) {
            return (
              <li key={t.key} className="panel-gold flex items-center gap-3 px-4 py-3">
                <Icon className="h-5 w-5 shrink-0 on-gold" />
                <span className="flex-1 truncate text-[15px] font-extrabold on-gold">
                  {PRAYER_NAMES[t.key]}
                </span>
                <span className="font-num-tabular text-lg font-extrabold on-gold">
                  {t.display}
                </span>
                <Bell className="h-4.5 w-4.5 shrink-0 on-gold" aria-hidden />
              </li>
            );
          }

          return (
            <li key={t.key} className="flex items-center gap-3 px-4 py-3">
              <Icon className="h-5 w-5 shrink-0 text-gold-soft" />
              <span className="flex-1 truncate text-[15px] font-semibold text-white">
                {PRAYER_NAMES[t.key]}
              </span>
              <span className="font-num-tabular text-lg font-bold text-white">{t.display}</span>
              {isPassed ? (
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-[#2fd08b]"
                  aria-label="Sudah lewat"
                />
              ) : (
                <span
                  aria-label={notifOn ? "Notifikasi aktif" : "Notifikasi nonaktif"}
                  title={notifOn ? `Notifikasi: ${notif.mode}` : "Notifikasi nonaktif"}
                >
                  {notifOn ? (
                    <Bell className="h-4.5 w-4.5 shrink-0 text-white/85" />
                  ) : (
                    <BellOff className="h-4.5 w-4.5 shrink-0 text-white/35" />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
