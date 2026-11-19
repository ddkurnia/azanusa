import { NextRequest, NextResponse } from "next/server";

/**
 * API pencarian masjid terdekat (realtime, sumber OpenStreetMap).
 *
 * Proxy server-side ke API Overpass dengan:
 *  - Permintaan paralel ke tiga mirror (overpass-api.de, kumi.systems,
 *    private.coffee) — hasil mirror tercepat yang sukses dipakai, sisanya
 *    dibatalkan. Tahan rate-limit/downtime salah satu mirror.
 *  - Cache memori 10 menit per bulat koordinat (~1 km) agar produksi hemat
 *    kuota Overpass dan respons cepat; tetap realtime (OSM berubah jarang).
 *  - Cakupan node + way + relation ("out center") — banyak masjid dipetakan
 *    sebagai area/way, bukan hanya titik.
 *
 * Param: lat, lng (wajib), radius (meter, opsional, 500-10000, default 3000),
 *        limit (opsional, default 30, maks 50).
 * Respons: { ok, count, cached, mosques: [{id,name,lat,lng,distanceKm}] }
 */

export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const CACHE_TTL_MS = 10 * 60_000;
const MEMORY_CACHE = new Map<string, { data: MosquesPayload; expiresAt: number }>();

interface MosqueItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

interface MosquesPayload {
  ok: boolean;
  count: number;
  cached?: boolean;
  mosques: MosqueItem[];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * toRad) / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(((lng2 - lng1) * toRad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Kirim kueri ke semua mirror sekaligus, kembalikan hasil tercepat yang sukses */
async function fetchOverpass(query: string): Promise<unknown> {
  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
  const attempts = OVERPASS_ENDPOINTS.map((endpoint, i) =>
    (async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.any([controllers[i].signal, AbortSignal.timeout(11_000)]),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${new URL(endpoint).host} HTTP ${res.status}`);
      return await res.json();
    })()
  );
  try {
    const winner = await Promise.any(attempts);
    for (const c of controllers) c.abort(); // batalkan mirror yang masih berjalan
    return winner;
  } catch (e) {
    if (e instanceof AggregateError) {
      const detail = e.errors.map((x) => String((x as Error).message ?? x)).join("; ");
      throw new Error(detail || "Semua layanan Overpass tidak dapat dijangkau");
    }
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json(
      { ok: false, error: "Parameter lat/lng wajib angka valid (contoh: ?lat=0.974&lng=102.695)" },
      { status: 400 }
    );
  }
  const radius = Math.min(10_000, Math.max(500, Number(p.get("radius")) || 3_000));
  const limit = Math.min(50, Math.max(1, Number(p.get("limit")) || 30));

  // Cache per bulat koordinat ~0.01 derajat (≈1 km) + radius
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
  const hit = MEMORY_CACHE.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ ...hit.data, cached: true });
  }

  const query =
    `[out:json][timeout:20];` +
    `(node(around:${radius},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];` +
    `way(around:${radius},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];` +
    `relation(around:${radius},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];);` +
    `out center ${Math.min(80, limit * 3)};`;

  try {
    const json = (await fetchOverpass(query)) as {
      elements?: {
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }[];
    };

    const seen = new Set<string>();
    const mosques: MosqueItem[] = (json.elements ?? [])
      .map((e) => {
        const mlat = e.lat ?? e.center?.lat;
        const mlng = e.lon ?? e.center?.lon;
        if (!Number.isFinite(mlat) || !Number.isFinite(mlng)) return null;
        const rawName = e.tags?.["name:en"] ?? e.tags?.name ?? "";
        return {
          id: `${e.type}/${e.id}`,
          name: rawName || "Masjid/musala (nama tidak tercatat)",
          lat: mlat as number,
          lng: mlng as number,
          distanceKm: haversineKm(lat, lng, mlat as number, mlng as number),
        } as MosqueItem;
      })
      .filter((m): m is MosqueItem => m !== null)
      // Dedup: nama + koordinat 4 desimal (~11 m) untuk node & way yang sama
      .filter((m) => {
        const k = `${m.name}|${m.lat.toFixed(4)}|${m.lng.toFixed(4)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    const payload: MosquesPayload = { ok: true, count: mosques.length, mosques };
    MEMORY_CACHE.set(cacheKey, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Layanan data masjid OpenStreetMap sedang tidak dapat dijangkau (${(e as Error).message})` },
      { status: 502 }
    );
  }
}
