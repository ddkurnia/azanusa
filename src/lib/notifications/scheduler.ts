"use client";

/**
 * Penjadwal pengingat waktu salat AZANUSA (sisi klien).
 *
 * MEKANISME & BATASAN (jujur):
 * - Aktif selama aplikasi terbuka (tab aktif atau latar belakang yang masih
 *   diizinkan browser). Memeriksa jadwal setiap ~20 detik.
 * - Notifikasi dikirim via Service Worker (registration.showNotification).
 * - Browser Android dapat menghentikan timer JavaScript saat browser ditutup
 *   atau perangkat tidur lama — PENGINGAT TIDAK DIJAMIN TERKIRIM pada kondisi
 *   tersebut. Untuk keandalan penuh diperlukan aplikasi Android native.
 */
import { azanPlayer } from "@/lib/audio/azan";
import type { PrayerKey, PrayerSchedule, PrayerNotifySetting } from "@/types";

const FIRED_KEY = "azanusa-fired";

function loadFired(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveFired(map: Record<string, boolean>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    // penuh / mode privat — abaikan
  }
}

function todayKey(dateISO: string, prayer: string, kind: string): string {
  return `${dateISO}:${prayer}:${kind}`;
}

export function pruneFired(scheduleDate: string) {
  const fired = loadFired();
  const prefix = `${scheduleDate}:`;
  const keep = Object.fromEntries(Object.entries(fired).filter(([k]) => k.startsWith(prefix)));
  if (Object.keys(keep).length !== Object.keys(fired).length) saveFired(keep);
}

export interface NotificationOutcome {
  fired: string[]; // daftar kind yang baru ditembakkan
}

/** Periksa & kirim notifikasi yang jatuh tempo. Dipanggil periodik dari UI. */
export async function checkAndNotify(
  schedule: PrayerSchedule | null,
  tomorrowSchedule: PrayerSchedule | null,
  settings: Record<PrayerKey, PrayerNotifySetting>,
  now: Date = new Date()
): Promise<NotificationOutcome> {
  const fired: string[] = [];
  if (typeof window === "undefined" || !schedule) return { fired };
  if (!("Notification" in window)) return { fired };
  if (Notification.permission !== "granted") return { fired };

  const reg = await navigator.serviceWorker?.getRegistration?.();
  const state = loadFired();

  const processSchedule = async (sched: PrayerSchedule) => {
    for (const t of sched.times) {
      const setting = settings[t.key];
      if (!setting || setting.mode === "off") continue;
      const timeMs = Date.parse(t.utcISO);
      if (Number.isNaN(timeMs)) continue;

      // Pengingat sebelum waktu salat
      if (setting.beforeMinutes > 0) {
        const beforeKey = todayKey(sched.date, t.key, "before");
        const beforeTime = timeMs - setting.beforeMinutes * 60_000;
        if (!state[beforeKey] && now.getTime() >= beforeTime && now.getTime() < timeMs) {
          await show(reg, {
            title: `Pengingat ${t.display} — Salat ${cap(t.key)} ${setting.beforeMinutes} menit lagi`,
            body: `Wilayah: ${sched.region.name}, ${sched.region.prov}`,
            tag: beforeKey,
            silent: setting.mode === "silent",
          });
          state[beforeKey] = true;
          fired.push(beforeKey);
        }
      }

      // Notifikasi tepat waktu
      const mainKey = todayKey(sched.date, t.key, "main");
      if (!state[mainKey] && now.getTime() >= timeMs && now.getTime() < timeMs + 5 * 60_000) {
        const silent = setting.mode === "silent";
        await show(reg, {
          title: `Waktunya salat ${cap(t.key)}`,
          body: `${t.display} — ${sched.region.name}, ${sched.region.prov}`,
          tag: mainKey,
          silent,
        });
        if (setting.mode === "azan" && azanPlayer.isUnlocked()) {
          azanPlayer.playAzan();
        } else if (setting.mode === "short") {
          azanPlayer.playChime();
        }
        state[mainKey] = true;
        fired.push(mainKey);
      }
    }
  };

  await processSchedule(schedule);
  if (tomorrowSchedule) await processSchedule(tomorrowSchedule);
  if (fired.length) saveFired(state);
  return { fired };
}

interface ShowArgs {
  title: string;
  body: string;
  tag: string;
  silent?: boolean;
}

async function show(reg: ServiceWorkerRegistration | undefined | null, args: ShowArgs) {
  try {
    if (reg) {
      await reg.showNotification(args.title, {
        body: args.body,
        tag: args.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        lang: "id",
        dir: "ltr",
        silent: args.silent,
        renotify: true,
      } as NotificationOptions & { renotify: boolean });
    } else {
      const n = new Notification(args.title, { body: args.body, tag: args.tag, silent: args.silent });
      n.onclick = () => window.focus();
    }
  } catch {
    // izin dicabut antar waktu — abaikan
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
