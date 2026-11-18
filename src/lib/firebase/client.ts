/**
 * Inisialisasi Firebase client AZANUSA.
 * Seluruh variabel diambil dari NEXT_PUBLIC_FIREBASE_* (aman di frontend).
 * Jika belum dikonfigurasi, fungsi mengembalikan null — aplikasi tetap
 * berjalan penuh dengan cache lokal (localStorage), tanpa fitur cloud.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function readClientConfig(): FirebaseClientConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
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
