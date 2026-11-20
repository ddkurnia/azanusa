"use client";

/**
 * Jembatan FCM di sisi aplikasi:
 * - Pesan push saat aplikasi di depan (foreground) ditampilkan sebagai
 *   notifikasi sistem via service worker (tag sama → tidak dobel dengan
 *   pengingat lokal NotificationTicker).
 * - Saat push aktif, perubahan lokasi/preferensi disinkronkan ke Firestore.
 */
import { useEffect, useRef } from "react";
import { onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase/client";
import { syncPushProfile, refreshPushToken, isPushConfigured } from "@/lib/notifications/push";
import { useAppStore } from "@/lib/store";

export function PushForeground() {
  const pushEnabled = useAppStore((s) => s.pushEnabled);
  const location = useAppStore((s) => s.location);
  const notifications = useAppStore((s) => s.notifications);
  const lastSync = useRef(0);

  // Listener pesan FCM saat aplikasi terbuka (foreground)
  useEffect(() => {
    if (!isPushConfigured()) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) return;
      unsub = onMessage(messaging, async (payload) => {
        const d = payload.data || {};
        const n = payload.notification || {};
        const title = d.title || n.title || "AZANUSA";
        const body = d.body || n.body || "Pengingat waktu salat";
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            tag: d.tag || "azanusa-push-fg",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            lang: "id",
            dir: "ltr",
            silent: d.silent === "1",
          });
        } catch {
          // izin dicabut / SW tidak siap — abaikan
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Sinkronkan lokasi/preferensi ke dokumen push bila push aktif (debounce 10 dtk)
  useEffect(() => {
    if (!pushEnabled || !location) return;
    const t = setTimeout(() => {
      const now = Date.now();
      if (now - lastSync.current < 10_000) return;
      lastSync.current = now;
      void syncPushProfile(location, notifications);
    }, 1000);
    return () => clearTimeout(t);
  }, [pushEnabled, location, notifications]);

  // Segarkan token FCM saat aplikasi dibuka: token lama bisa mati setelah
  // service worker diperbarui (deploy baru) atau subscription dirotasi —
  // tanpa ini push cloud berhenti diam-diam walau sakelar masih "on".
  useEffect(() => {
    if (!pushEnabled) return;
    const t = setTimeout(() => {
      void refreshPushToken();
    }, 8000);
    return () => clearTimeout(t);
  }, [pushEnabled]);

  // Tick mandiri: setiap aplikasi yang terbuka memicu dispatcher server
  // (dibatasi server 1×/menit) sehingga pengingat terkirim ke semua perangkat
  // — termasuk aplikasi yang sedang tertutup — tanpa cron eksternal.
  // Interval 65 detik (> throttle server 60 dtk) memastikan push "tepat waktu"
  // tiba dalam ≤ ~1 menit sejak waktu salat bila ada satu saja perangkat yang
  // aplikasinya hidup; tick instan saat pengguna kembali ke aplikasi/jaringan
  // pulih menutup celah saat tab sempat dibekukan peramban.
  useEffect(() => {
    const tick = () => {
      fetch("/api/notifications/tick", { keepalive: true }).catch(() => {});
    };
    const t0 = setTimeout(tick, 4000);
    const interval = setInterval(tick, 65_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const onOnline = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(t0);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
