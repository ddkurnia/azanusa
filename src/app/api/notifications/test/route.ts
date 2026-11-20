import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * Push uji AZANUSA — kirim satu pesan FCM ke perangkat pemanggil sendiri.
 *
 * Tujuan: memverifikasi jalur push cloud penuh (token valid → FCM →
 * service worker → notifikasi tampil) TANPA menunggu waktu salat.
 *
 * Keamanan & batasan:
 * - Hanya mengirim ke token yang tersimpan pada dokumen users/{uid} milik
 *   perangkat pemanggil (uid dari anonymous auth klien).
 * - Isi pesan tetap (tidak mengambil input teks) → tidak bisa dipakai spam
 *   konten; dibatasi 1 kirim per 2 menit per perangkat.
 * - Tidak membocorkan data pengguna lain; jawaban hanya status pengiriman.
 */

const RATE_MS = 2 * 60_000;
const lastSent = new Map<string, number>();

function bad(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { uid?: string } | null;
  const uid = body?.uid;
  if (!uid || typeof uid !== "string" || !/^[A-Za-z0-9:_-]{10,64}$/.test(uid)) {
    return bad("uid tidak valid", 400);
  }

  const now = Date.now();
  const last = lastSent.get(uid) ?? 0;
  if (now - last < RATE_MS) {
    return bad("Tunggu 2 menit antar push uji", 429);
  }

  const db = await getAdminDb();
  if (!db) return bad("Firebase Admin (Firestore) belum dikonfigurasi", 503);
  const messaging = await getAdminMessaging();
  if (!messaging) return bad("Firebase Admin (Messaging) belum tersedia", 503);

  let exists = false;
  let user: { pushToken?: string; pushEnabled?: boolean } = {};
  try {
    const snap = await db.collection("users").doc(uid).get();
    exists = snap.exists;
    user = (snap.data() ?? {}) as { pushToken?: string; pushEnabled?: boolean };
  } catch {
    return bad("Perangkat tidak dapat diperiksa", 500);
  }
  if (!exists) {
    return bad("Perangkat belum terdaftar — nyalakan Push notifikasi di Pengaturan dulu", 404);
  }
  if (user.pushEnabled !== true || !user.pushToken) {
    return bad("Push tidak aktif pada perangkat ini", 409);
  }

  lastSent.set(uid, now);
  const title = "Push uji AZANUSA";
  const bodyText = "Jalur push cloud berfungsi. Pengingat azan akan tampil seperti ini juga.";
  const tag = `azanusa-test-${now}`;
  try {
    await messaging.send({
      token: user.pushToken,
      data: { title, body: bodyText, tag, url: "/" },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title,
          body: bodyText,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag,
          lang: "id",
        },
      },
    });
    return NextResponse.json({
      ok: true,
      detail: "Push uji terkirim — periksa notifikasi di perangkat ini.",
    });
  } catch (e) {
    const err = e as { code?: number | string; errorDetails?: string; message?: string };
    const detail = String(err.errorDetails ?? err.message ?? "gagal kirim").slice(0, 200);
    return NextResponse.json(
      { ok: false, error: `FCM menolak pesan: ${detail}` },
      { status: 502 }
    );
  }
}
