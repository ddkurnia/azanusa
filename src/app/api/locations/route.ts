import { NextRequest, NextResponse } from "next/server";
import { searchRegions, getAllProvinces, nearestRegion } from "@/lib/location/regions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = params.get("lat");
  const lng = params.get("lng");

  // Pencarian wilayah terdekat dari koordinat perangkat
  if (lat && lng) {
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isNaN(la) || Number.isNaN(ln)) {
      return NextResponse.json({ ok: false, error: "lat/lng tidak valid" }, { status: 400 });
    }
    const { region, distanceKm } = nearestRegion(la, ln);
    return NextResponse.json({
      ok: true,
      provinces: getAllProvinces(),
      results: [{ ...region, distanceKm }],
    });
  }

  const q = params.get("q") ?? "";
  const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? "25")));
  if (!q.trim()) {
    return NextResponse.json({ ok: true, provinces: getAllProvinces(), results: [] });
  }
  const results = searchRegions(q, limit);
  return NextResponse.json({ ok: true, provinces: getAllProvinces(), results });
}
