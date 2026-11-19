/**
 * Inisialisasi Firebase client AZANUSA.
 * Seluruh variabel diambil dari NEXT_PUBLIC_FIREBASE_* (aman di frontend).
 * Jika belum dikonfigurasi, fungsi mengembalikan null — aplikasi tetap
 * berjalan penuh dengan cache lokal (localStorage), tanpa fitur cloud.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

/**
 * Konfigurasi web Firebase AZANUSA — nilai publik (by-design, sama seperti di
 * public/sw.js). NEXT_PUBLIC_FIREBASE_* tetap diutamakan bila diset saat build;
 * fallback di bawah membuat push berfungsi otomatis di lingkungan mana pun
 * (Vercel tanpa env, dev lokal, dsb.) tanpa langkah konfigurasi tambahan.
 * Data sensitif server (FIREBASE_PRIVATE_KEY, CRON_SECRET) TIDAK pernah
 * ikut di sini — hanya via env di sisi server.
 */
const FIREBASE_CLIENT_DEFAULTS = {
  apiKey: "AIzaSyBlfeY4i5IpUnF9sj04EUrBdQ7krIltypg",
  authDomain: "azanusa.firebaseapp.com",
  projectId: "azanusa",
  storageBucket: "azanusa.firebasestorage.app",
  messagingSenderId: "455086348247",
  appId: "1:455086348247:web:9d3396daa6fb7671fa9d92",
} as const;

export function readClientConfig(): FirebaseClientConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? FIREBASE_CLIENT_DEFAULTS.apiKey;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? FIREBASE_CLIENT_DEFAULTS.projectId;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? FIREBASE_CLIENT_DEFAULTS.appId;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? FIREBASE_CLIENT_DEFAULTS.authDomain,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? FIREBASE_CLIENT_DEFAULTS.storageBucket,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? FIREBASE_CLIENT_DEFAULTS.messagingSenderId,
  };
}

export function isFirebaseConfigured(): boolean {
  return readClientConfig() !== null;
}

export function getFirebaseApp(): FirebaseApp | null {
  const cfg = readClientConfig();
  if (!cfg) return null;
  try {
    return getApps().length ? getApp() : initializeApp(cfg);
  } catch {
    return null;
  }
}

export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch {
    return null;
  }
}

/** Auth client (untuk anonymous auth — identitas perangkat di Firestore rules) */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getAuth(app);
  } catch {
    return null;
  }
}

/**
 * Messaging client untuk FCM (Firebase Cloud Messaging).
 * Mengembalikan null bila konfigurasi kosong atau peramban tidak mendukung
 * web push (mis. browser in-app tanpa service worker).
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const app = getFirebaseApp();
  if (!app) return null;
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    if (!(await isSupported())) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}

/**
 * Pastikan ada identitas anonymous (Firebase Authentication).
 * Dipakai agar Firestore rules users/{uid} tetap ketat: dokumen token push
 * hanya dapat dibaca/ditulis oleh perangkat pemiliknya.
 * Mengembalikan uid, atau error berkode auth/* bila provider Anonymous
 * belum diaktifkan di console Firebase.
 */
export async function ensureAnonymousUser(): Promise<string> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("auth/unavailable");
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation") {
      throw new Error("auth/anonymous-disabled");
    }
    throw e;
  }
}
