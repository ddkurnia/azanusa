import { NextResponse } from "next/server";
import { dispatchPrayerPushes } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

/**
 * Tick mandiri AZANUSA — pemicu dispatcher TANPA secret, dibatasi ketat
 * maksimal 1× per 60 detik per instance server.
 *
 * Dipanggil beacon dari aplikasi (PushForeground) setiap kali ada pengguna
 * yang membuka AZANUSA, sehingga pengingat salat tetap terkirim ke SEMUA
 * perangkat terdaftar (termasuk aplikasi yang sedang tertutup) tanpa
 * memerlukan cron eksternal. Cron eksternal (GitHub Actions/cron-job.org)
 * tetap disarankan sebagai pelengkap agar cakupan penuh 24 jam.
 *
 * Keamanan: endpoint tidak membocorkan data; dispatcher dedup per hari
 * (lastNotified) sehingga tick berulang tidak men-dobel pengiriman; beban
 * dibatasi 1 jalankan/menit/instance + maksimal 500 pengguna per jalankan.
 */
const MIN_INTERVAL_MS = 60_000;
let lastRun = 0;
let running = false;

async function handle() {
  const now = Date.now();
  if (running || now - lastRun < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, ran: false, reason: "throttled" });
  }
  running = true;
  lastRun = now;
  try {
    const summary = await dispatchPrayerPushes();
    return NextResponse.json({
      ok: true,
      ran: true,
      at: new Date().toISOString(),
      ...summary,
    });
  } catch (e) {
    // 503: umumnya konfigurasi server (FIREBASE_*) belum diisi — beacon boleh
    // mencoba lagi di tick berikutnya.
    return NextResponse.json(
      { ok: false, ran: true, error: (e as Error).message },
      { status: 503 }
    );
  } finally {
    running = false;
  }
}

export const GET = handle;
export const POST = handle;
