import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Health check AZANUSA */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "AZANUSA",
    slogan: "Satu Indonesia, Satu Pengingat Waktu Salat.",
    time: new Date().toISOString(),
  });
}
