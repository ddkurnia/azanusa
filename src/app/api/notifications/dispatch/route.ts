import { NextRequest, NextResponse } from "next/server";
import { dispatchPrayerPushes } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

/**
 * Endpoint cron pengiriman push pengingat salat.
 *
 * Dipanggil berkala (1-5 menit) oleh cron eksternal dengan CRON_SECRET:
 *   GET /api/notifications/dispatch?secret=xxxx
 *   atau header: Authorization: Bearer xxxx
 *
 * Jawaban: { ok, checked, sent, skipped, deadTokens, errors, details }
 */
function unauthorized(message: string, status = 403) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return unauthorized("CRON_SECRET belum dikonfigurasi di server", 503);
  }

  const provided =
    req.nextUrl.searchParams.get("secret") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || provided !== secret) {
    return unauthorized("Secret tidak valid");
  }

  try {
    const summary = await dispatchPrayerPushes();
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
