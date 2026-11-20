"use client";

/**
 * Push notification AZANUSA via Firebase Cloud Messaging (FCM).
 *
 * Alur:
 * 1. Izin Notification diminta saat pengguna menyalakan sakelar push.
 * 2. Identitas anonymous dibuat (Firebase Auth) — dokumen users/{uid} di
 *    Firestore hanya milik perangkat ini (lihat firestore.rules).
 * 3. Token FCM didapat via service worker /sw.js (yang memuat handler FCM).
 * 4. Token + lokasi + preferensi per salat disimpan di Firestore; endpoint
 *    /api/notifications/dispatch (dipanggil cron) mengirim push saat waktu salat masuk.
 *
 * Pengingat saat aplikasi TERBUKA tetap ditangani mesin lokal
 * (src/lib/notifications/scheduler.ts) — mekanisme ini menambah jangkauan
 * saat aplikasi DITUTUP.
 */
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteToken, getToken } from "firebase/messaging";
import {
  ensureAnonymousUser,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseMessaging,
  readClientConfig,
} from "@/lib/firebase/client";
import type { Region } from "@/types";
import type { AppSettings } from "@/types";

export type PushStatus =
  | { state: "ok"; token: string }
  | { state: "permission"; detail: string }
  | { state: "unsupported"; detail: string }
  | { state: "auth"; detail: string }
  | { state: "error"; detail: string };

type NotifPrefs = AppSettings["notifications"];

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "Notification" in window;
}

export function isPushConfigured(): boolean {
  return readClientConfig() !== null;
}

/** Daftarkan push: izin → anonymous auth → token FCM → simpan profil di Firestore */
export async function enablePushNotifications(
  region: Region,
  notifications: NotifPrefs
): Promise<PushStatus> {
  if (!isPushConfigured()) {
    return { state: "error", detail: "Konfigurasi Firebase belum diisi (.env.local / Vercel env)" };
  }
  if (!isPushSupported()) {
    return { state: "unsupported", detail: "Peramban ini tidak mendukung web push" };
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return { state: "permission", detail: "Izin notifikasi tidak diberikan" };
    }

    const uid = await getOrCreateUid();

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { state: "unsupported", detail: "FCM tidak tersedia di peramban ini" };
    }

    const reg = await navigator.serviceWorker.ready;
    const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;
    const token = await getToken(messaging, {
      vapidKey: vapid,
      serviceWorkerRegistration: reg,
    });
    if (!token) {
      return { state: "error", detail: "Token FCM tidak dapat dibuat" };
    }

    const db = getFirebaseDb();
    if (!db) return { state: "error", detail: "Firestore tidak tersedia" };

    await setDoc(
      doc(db, "users", uid),
      {
        pushEnabled: true,
        pushToken: token,
        pushPlatform: "web",
        location: {
          code: region.code,
          name: region.name,
          prov: region.prov,
          lat: region.lat,
          lng: region.lng,
          tz: region.tz,
        },
        notifications: notifications,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { state: "ok", token };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "auth/anonymous-disabled" || err.message?.includes("auth/anonymous-disabled")) {
      return {
        state: "auth",
        detail:
          "Anonymous Authentication belum diaktifkan di console Firebase (Authentication → Sign-in method → Anonymous)",
      };
    }
    return { state: "error", detail: err.message ?? "Gagal mendaftarkan push" };
  }
}

/** Matikan push: hapus token FCM + tandai nonaktif di Firestore */
export async function disablePushNotifications(): Promise<PushStatus> {
  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) await deleteToken(messaging);
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    if (db && auth?.currentUser) {
      await deleteDoc(doc(db, "users", auth.currentUser.uid));
    }
    return { state: "ok", token: "" };
  } catch (e) {
    return { state: "error", detail: (e as Error).message ?? "Gagal mematikan push" };
  }
}

/** Sinkronkan lokasi/preferensi terbaru ke dokumen push (bila push aktif) */
export async function syncPushProfile(
  region: Region,
  notifications: NotifPrefs
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    if (!db || !auth?.currentUser) return false;
    const ref = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data()?.pushEnabled !== true) return false;
    await setDoc(
      ref,
      {
        location: {
          code: region.code,
          name: region.name,
          prov: region.prov,
          lat: region.lat,
          lng: region.lng,
          tz: region.tz,
        },
        notifications: notifications,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Segarkan token FCM saat aplikasi dibuka dan simpan bila berubah.
 *
 * PENTING: token web push dapat menjadi tidak valid setelah service worker
 * diperbarui (deploy baru) atau subscription dirotasi peramban — tanpa
 * pembaruan ini push cloud berhenti diam-diam padahal sakelar masih "on".
 * getToken idempoten: mengembalikan token lama bila masih valid.
 */
export async function refreshPushToken(): Promise<boolean> {
  try {
    if (!isPushConfigured() || !isPushSupported()) return false;
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return false; // push belum pernah diaktifkan di perangkat ini
    const messaging = await getFirebaseMessaging();
    if (!messaging) return false;
    const reg = await navigator.serviceWorker.ready;
    const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;
    const token = await getToken(messaging, {
      vapidKey: vapid,
      serviceWorkerRegistration: reg,
    });
    if (!token) return false;
    const db = getFirebaseDb();
    if (!db) return false;
    const ref = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data()?.pushEnabled !== true) return false;
    if (snap.data()?.pushToken === token) return true; // masih valid — tidak perlu tulis
    await setDoc(ref, { pushToken: token, updatedAt: serverTimestamp() }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Kirim push uji via server ke perangkat ini — memverifikasi jalur FCM penuh
 * (token valid → FCM → service worker → notifikasi) tanpa menunggu waktu salat.
 */
export async function sendTestPush(): Promise<{ ok: boolean; detail: string }> {
  try {
    const uid = await ensureAnonymousUser();
    const res = await fetch("/api/notifications/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    const j = (await res.json().catch(() => null)) as {
      ok?: boolean;
      detail?: string;
      error?: string;
    } | null;
    if (!j) return { ok: false, detail: `Server menjawab HTTP ${res.status}` };
    return { ok: Boolean(j.ok), detail: j.detail ?? j.error ?? "" };
  } catch (e) {
    return { ok: false, detail: (e as Error).message ?? "Gagal menghubungi server" };
  }
}

async function getOrCreateUid(): Promise<string> {
  const { ensureAnonymousUser } = await import("@/lib/firebase/client");
  try {
    return await ensureAnonymousUser();
  } catch (e) {
    if ((e as Error).message === "auth/anonymous-disabled") {
      throw Object.assign(new Error("auth/anonymous-disabled"), { code: "auth/anonymous-disabled" });
    }
    throw e;
  }
}
