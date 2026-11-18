/**
 * Proxy API Al-Qur'an AZANUSA — meneruskan permintaan ke equran.id (API publik)
 * agar bebas masalah CORS di sisi peramban. Tidak ada data yang diubah/dibuat-buat.
 *
 * GET /api/quran?list=1     -> daftar 114 surat
 * GET /api/quran?surah=<n>  -> detail surat n + ayat (Arab, latin, terjemahan ID)
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = "https://equran.id/api/v2";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const list = sp.get("list");
  const surah = sp.get("surah");

  let path: string | null = null;
  if (list === "1") path = "/surat";
  else if (surah && /^\d{1,3}$/.test(surah)) {
    const n = Math.min(114, Math.max(1, parseInt(surah, 10)));
    path = `/surat/${n}`;
  }

  if (!path) {
    return NextResponse.json(
      { ok: false, error: "Parameter tidak valid. Gunakan ?list=1 atau ?surah=<1..114>" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `Layanan Al-Qur'an menolak (HTTP ${upstream.status})` },
        { status: 502 }
      );
    }
    const j = (await upstream.json()) as { code?: number; data?: unknown; message?: string };
    if (j.code !== 200 || !j.data) {
      return NextResponse.json(
        { ok: false, error: j.message ?? "Data Al-Qur'an tidak tersedia" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { ok: true, data: j.data },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Gagal menghubungi layanan Al-Qur'an: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
