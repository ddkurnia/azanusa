import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const APP_VERSION = "1.0.0";

/**
 * Endpoint konfigurasi publik — HANYA memaparkan versi aplikasi.
 * Status konfigurasi internal (SIHAT, Firebase, mirror) tidak diungkap ke klien
 * demi privasi & keamanan; diagnosis server dilakukan via log/panel admin.
 */
export async function GET() {
  return NextResponse.json({ ok: true, appVersion: APP_VERSION });
}
