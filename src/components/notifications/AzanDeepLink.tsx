"use client";

/**
 * AzanDeepLink — memutar azan otomatis ketika pengguna MENYENTUH notifikasi
 * azan (push FCM saat aplikasi tertutup) atau laporan dari Service Worker.
 *
 * Alur:
 * 1. Push "Masuk waktu salat X" tiba saat aplikasi tertutup → notifikasi sistem
 *    tampil (bunyi notifikasi perangkat).
 * 2. Pengguna mengetuk notifikasi → Service Worker membuka AZANUSA dengan
 *    URL `/?azan=<key>&t=<ms>` (atau memfokus klien yang ada + postMessage).
 * 3. Komponen ini menangkap keduanya, memutar azan sesuai mode per salat
 *    (klik notifikasi = aktivitas pengguna sehingga autoplay diizinkan),
 *    menandai pengingat tersebut sudah diputar agar tidak dobel dengan
 *    NotificationTicker, lalu membersihkan parameter dari URL.
 *
 * Batasan platform (jujur): pemutar audio web tetap butuh sentuhan pengguna —
 * itulah mengapa azan penuh diputar SAAT notifikasi diketuk, bukan di latar
 * belakang tanpa interaksi (bunyi yang terdengar di latar adalah nada
 * notifikasi perangkat).
 */

import { useEffect, useRef } from "react";
import { azanPlayer } from "@/lib/audio/azan";
import { useAppStore } from "@/lib/store";
import { dateStrInTz } from "@/lib/timezone";
import { PRAYER_KEYS, type PrayerKey } from "@/types";

const FIRED_KEY = "azanusa-fired";
/** Notifikasi lebih tua dari 30 menit tidak lagi memutar azan otomatis */
const MAX_AGE_MS = 30 * 60_000;

export function AzanDeepLink() {
  const volume = useAppStore((s) => s.volume);
  const notifications = useAppStore((s) => s.notifications);
  const tz = useAppStore((s) => s.location?.tz ?? "Asia/Jakarta");
  const cfgRef = useRef({ volume, notifications, tz });
  useEffect(() => {
    cfgRef.current = { volume, notifications, tz };
  }, [volume, notifications, tz]);

  useEffect(() => {
    const markFired = (key: PrayerKey, tMs: number | null) => {
      try {
        const { tz: zone } = cfgRef.current;
        const dateKey = dateStrInTz(new Date(tMs ?? Date.now()), zone);
        const map = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, boolean>;
        map[`${dateKey}:${key}:audio`] = true;
        map[`${dateKey}:${key}:main`] = true;
        localStorage.setItem(FIRED_KEY, JSON.stringify(map));
      } catch {
        // penyimpanan penuh / privat — abaikan
      }
    };

    const play = (key: PrayerKey, tMs: number | null) => {
      if (!PRAYER_KEYS.includes(key)) return;
      if (tMs !== null && Number.isFinite(tMs) && Math.abs(Date.now() - tMs) > MAX_AGE_MS) return;
      const { volume: vol, notifications: prefs } = cfgRef.current;
      const mode = prefs[key]?.mode ?? "azan";
      azanPlayer.setVolume(vol);
      if (mode === "azan") void azanPlayer.playAzan();
      else if (mode === "short") azanPlayer.playChime();
      markFired(key, tMs);
    };

    const fromUrl = () => {
      let url: URL;
      try {
        url = new URL(window.location.href);
      } catch {
        return;
      }
      const azan = url.searchParams.get("azan") as PrayerKey | null;
      if (!azan) return;
      const rawT = url.searchParams.get("t");
      const tMs = rawT ? Number(rawT) : null;
      play(azan, tMs !== null && Number.isFinite(tMs) ? tMs : null);
      url.searchParams.delete("azan");
      url.searchParams.delete("t");
      const clean = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, "", clean);
    };

    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (!d || d.type !== "play-azan" || !d.url) return;
      try {
        const u = new URL(d.url, window.location.origin);
        const azan = u.searchParams.get("azan") as PrayerKey | null;
        if (!azan) return;
        const rawT = u.searchParams.get("t");
        const tMs = rawT ? Number(rawT) : null;
        play(azan, tMs !== null && Number.isFinite(tMs) ? tMs : null);
      } catch {
        // url tidak valid — abaikan
      }
    };

    fromUrl();
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  return null;
}
