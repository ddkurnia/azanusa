/**
 * Firebase Admin (server-side only — API routes).
 * Kredensial service account diambil dari environment variables, TIDAK PERNAH
 * ditulis di source code. Jika belum dikonfigurasi, getAdminDb() mengembalikan
 * null dan cache memakai memori proses.
 */
import "server-only";

let adminDbPromise: Promise<import("firebase-admin/firestore").Firestore> | null | undefined;
let adminAppPromise: Promise<import("firebase-admin/app").App> | null | undefined;

function readAdminEnv(): { projectId: string; clientEmail: string; privateKey: string } | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) return null;
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return { projectId, clientEmail, privateKey };
}

export function isAdminConfigured(): boolean {
  return readAdminEnv() !== null;
}

async function getAdminApp(): Promise<import("firebase-admin/app").App | null> {
  if (adminAppPromise !== undefined) return adminAppPromise;
  const cred = readAdminEnv();
  if (!cred) {
    adminAppPromise = null;
    return null;
  }
  try {
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const app =
      getApps().find((a) => a.name === "azanusa-admin") ??
      initializeApp(
        {
          credential: cert({ projectId: cred.projectId, clientEmail: cred.clientEmail, privateKey: cred.privateKey }),
          projectId: cred.projectId,
        },
        "azanusa-admin"
      );
    adminAppPromise = Promise.resolve(app);
    return adminAppPromise;
  } catch (e) {
    console.error("[firebase-admin] inisialisasi gagal:", (e as Error).message);
    adminAppPromise = null;
    return null;
  }
}

/** Firebase Cloud Messaging (Admin) — pengirim push pengingat salat */
export async function getAdminMessaging(): Promise<
  import("firebase-admin/messaging").Messaging | null
> {
  const app = await getAdminApp();
  if (!app) return null;
  try {
    const { getMessaging } = await import("firebase-admin/messaging");
    return getMessaging(app);
  } catch (e) {
    console.error("[firebase-admin] messaging gagal:", (e as Error).message);
    return null;
  }
}

export async function getAdminDb(): Promise<import("firebase-admin/firestore").Firestore | null> {
  if (adminDbPromise !== undefined) return adminDbPromise;
  const cred = readAdminEnv();
  if (!cred) {
    adminDbPromise = null;
    return null;
  }
  try {
    const [{ getApps, initializeApp, cert }, { getFirestore }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
    const app =
      getApps().find((a) => a.name === "azanusa-admin") ??
      initializeApp(
        {
          credential: cert({ projectId: cred.projectId, clientEmail: cred.clientEmail, privateKey: cred.privateKey }),
          projectId: cred.projectId,
        },
        "azanusa-admin"
      );
    adminDbPromise = Promise.resolve(getFirestore(app));
    return adminDbPromise;
  } catch (e) {
    console.error("[firebase-admin] inisialisasi gagal:", (e as Error).message);
    adminDbPromise = null;
    return null;
  }
}
