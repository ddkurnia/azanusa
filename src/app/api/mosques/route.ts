import { NextRequest, NextResponse } from "next/server";

/**
 * API pencarian masjid terdekat — PENCADANG (mode "server").
 *
 * CATATAN ARSITEKTUR: sumber utama adalah panggilan langsung dari perangkat
 * pengguna ke Overpass (Overpass menyatakan diri untuk pemakaian browser;
 * IP datacenter seperti Vercel kerap dibatasi 429/406). Route ini hanya
 * dipakai bila panggilan langsung dari perangkat gagal, sehingga hemat kuota:
 *  - Round-robin bergilir antar mirror (1 kueri per panggilan, bukan balapan
 *    3 mirror) dengan timeout 8 detik per mirror.
 *  - Cache sukses 20 menit per bulat koordinat (~1 km); cache gagal 60 detik
 *    agar saat semua mirror dibatasi, kuota tidak dibakar terus-menerus.
 *  - Dedupe in-flight: panggilan serentak untuk kunci sama menunggu satu kueri.
 *
 * Param: lat, lng (wajib), radius (meter, opsional, 500-10000, default 3000),
 *        limit (opsional, default 30, maks 50).
 * Respons: { ok, count, cached?, mosques: [{id,name,lat,lng,distanceKm}] }
 */

export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const SUCCESS_TTL_MS = 20 * 60_000;
const FAILURE_TTL_MS = 60_000;
const MEMORY_CACHE = new Map<string, { data: MosquesPayload; expiresAt: number }>();
const IN_FLIGHT = new Map<string, Promise<MosquesPayload>>();
let mirrorCursor = 0;

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

function buildQuery(lat: number, lng: number, radius: number, limit: number): string {
  return (
    `[out:json][timeout:15];` +
    `(node(around:${radius},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];` +
    `way(around:${radius},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];` +
    `relation(around:${radius},${lat},${lng})["amenity"="place_of_worship"]["religion"="muslim"];);` +
    `out center ${Math.min(80, limit * 3)};`
  );
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function toMosques(
  json: { elements?: OverpassElement[] },
  lat: number,
  lng: number,
  limit: number
): MosqueItem[] {
  const seen = new Set<string>();
  return (json.elements ?? [])
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
}

/** Satu kueri Overpass per panggilan — mulai dari mirror berikutnya (round-robin) */
async function queryOverpass(
  lat: number,
  lng: number,
  radius: number,
  limit: number
): Promise<MosquesPayload> {
  const query = buildQuery(lat, lng, radius, limit);
  const errors: string[] = [];
  const start = mirrorCursor;
  for (let i = 0; i < 2; i++) {
    // maks 2 mirror per panggilan agar cepat kembali ke klien
    const endpoint = OVERPASS_ENDPOINTS[(start + i) % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!res.ok) {
        errors.push(`${new URL(endpoint).host} HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      mirrorCursor = (start + i + 1) % OVERPASS_ENDPOINTS.length;
      const mosques = toMosques(json, lat, lng, limit);
      return { ok: true, count: mosques.length, mosques };
    } catch (e) {
      errors.push(`${new URL(endpoint).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join("; ") || "Semua layanan Overpass tidak dapat dijangkau");
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

  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
  const hit = MEMORY_CACHE.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ ...hit.data, cached: true });
  }

  // Dedupe in-flight: panggilan serentak untuk wilayah sama menunggu satu kueri
  let flight = IN_FLIGHT.get(cacheKey);
  if (!flight) {
    flight = queryOverpass(lat, lng, radius, limit)
      .then((payload) => {
        MEMORY_CACHE.set(cacheKey, { data: payload, expiresAt: Date.now() + SUCCESS_TTL_MS });
        return payload;
      })
      .catch((e: Error) => {
        // Cache negatif singkat: hentikan penembakan beruntun saat mirror dibatasi
        MEMORY_CACHE.set(cacheKey, {
          data: { ok: false, count: 0, mosques: [] },
          expiresAt: Date.now() + FAILURE_TTL_MS,
        });
        throw e;
      })
      .finally(() => IN_FLIGHT.delete(cacheKey));
    IN_FLIGHT.set(cacheKey, flight);
  }

  try {
    const payload = await flight;
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Layanan data masjid OpenStreetMap sedang tidak dapat dijangkau (${(e as Error).message})` },
      { status: 502 }
    );
  }
}
