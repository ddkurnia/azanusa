import { NextRequest, NextResponse } from "next/server";
import {
  MosqueItem,
  OVERPASS_SERVER_MIRRORS,
  PHOTON_BASE,
  PHOTON_TERMS,
  buildOverpassQuery,
  overpassToMosques,
  photonBbox,
  photonToMosques,
  type OverpassElement,
  type PhotonFeature,
} from "@/lib/mosques";

/**
 * API pencarian masjid terdekat — PENCADANG (mode "server").
 *
 * Sumber utama adalah panggilan langsung dari perangkat pengguna ke Overpass
 * (Overpass dirancang untuk pemakaian browser; IP datacenter seperti Vercel
 * kerap dibatasi 429/406). Route ini dipakai bila panggilan langsung gagal.
 *
 * Ketahanan:
 *  - LAPIS 1 Overpass: round-robin bergilir antar 5 mirror; maks 4 percobaan
 *    per panggilan, timeout 4 detik per mirror (total terkendali di bawah
 *    maxDuration). Header User-Agent/Accept eksplisit.
 *  - LAPIS 2 Photon (Komoot): saat semua mirror Overpass gagal — mirror
 *    Overpass umumnya menolak IP datacenter (429/406/502) — pencarian nama
 *    "masjid/musala/…" dalam bbox; Photon ramah datacenter.
 *  - Kueri luas (semua amenity=place_of_worship + building=mosque) dengan
 *    penyaringan indikasi muslim di JS — tag religion sering hilang pada
 *    data masjid Indonesia.
 *  - Cache sukses 20 menit per bulat koordinat (~1 km); cache gagal 45 detik
 *    dan MEMUAT PESAN ERROR (tidak lagi gagal senyap).
 *  - Dedupe in-flight: panggilan serentak untuk kunci sama menunggu satu kueri.
 *
 * Param: lat, lng (wajib), radius (meter, opsional, 500-10000, default 3000),
 *        limit (opsional, default 30, maks 50).
 * Respons: { ok, count, via?, cached?, radius, mosques: [{id,name,lat,lng,distanceKm}] }
 *          atau { ok:false, error } dengan status 502.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const ATTEMPTS_PER_CALL = 4;
const PER_ATTEMPT_TIMEOUT_MS = 4_000;
const SUCCESS_TTL_MS = 20 * 60_000;
const FAILURE_TTL_MS = 45_000;

interface FailurePayload {
  ok: false;
  count: 0;
  mosques: MosqueItem[];
  error: string;
}

const MEMORY_CACHE = new Map<string, { data: MosquesPayload | FailurePayload; expiresAt: number }>();
const IN_FLIGHT = new Map<string, Promise<MosquesPayload>>();

interface MosquesPayload {
  ok: boolean;
  count: number;
  via?: string;
  radius: number;
  cached?: boolean;
  mosques: MosqueItem[];
}

let mirrorCursor = 0;

async function fetchOneMirror(endpoint: string, query: string): Promise<{ elements: OverpassElement[] } | null> {
  const host = new URL(endpoint).host;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "AZANUSA/1.0 (+https://azanusa.vercel.app)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[mosques] ${host} HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return { elements: json.elements ?? [] };
  } catch (e) {
    console.warn(`[mosques] ${host} gagal: ${(e as Error).message}`);
    return null;
  }
}

/** Coba hingga 4 mirror bergilir; kembalikan payload pertama yang sukses. */
async function queryOverpass(
  lat: number,
  lng: number,
  radius: number,
  limit: number
): Promise<MosquesPayload> {
  const query = buildOverpassQuery(lat, lng, radius, limit * 3);
  const errors: string[] = [];
  const start = mirrorCursor;
  for (let i = 0; i < ATTEMPTS_PER_CALL; i++) {
    const endpoint = OVERPASS_SERVER_MIRRORS[(start + i) % OVERPASS_SERVER_MIRRORS.length];
    const host = new URL(endpoint).host;
    const json = await fetchOneMirror(endpoint, query);
    if (json) {
      mirrorCursor = (start + i + 1) % OVERPASS_SERVER_MIRRORS.length;
      const mosques = overpassToMosques(json, lat, lng, limit);
      return { ok: true, count: mosques.length, via: host, radius, mosques };
    }
    errors.push(host);
  }
  throw new Error(`Semua mirror Overpass gagal (${errors.join(", ")})`);
}

/** LAPIS 2 — Photon: pencarian nama masjid/musala per kata kunci dalam bbox. */
async function queryPhoton(lat: number, lng: number, radius: number, limit: number): Promise<MosquesPayload> {
  const bbox = photonBbox(lat, lng, radius);
  const requests = PHOTON_TERMS.map((term) =>
    fetch(`${PHOTON_BASE}?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lng}&bbox=${encodeURIComponent(bbox)}&limit=50`, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "AZANUSA/1.0 (+https://azanusa.vercel.app)" },
      cache: "no-store",
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ features?: PhotonFeature[] }>) : null))
      .catch(() => null)
  );
  const results = await Promise.all(requests);
  const features = results.flatMap((r) => r?.features ?? []);
  const mosques = photonToMosques(features, lat, lng, limit);
  return { ok: true, count: mosques.length, via: "photon-komoot", radius, mosques };
}

/** Overpass dulu, bila gagal Photon. */
async function queryMosques(lat: number, lng: number, radius: number, limit: number): Promise<MosquesPayload> {
  let overpassErr: Error | null = null;
  try {
    return await queryOverpass(lat, lng, radius, limit);
  } catch (e) {
    overpassErr = e as Error;
  }
  try {
    return await queryPhoton(lat, lng, radius, limit);
  } catch (e) {
    throw new Error(
      `Overpass: ${overpassErr?.message ?? "gagal"}; Photon: ${(e as Error).message}`
    );
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

  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
  const hit = MEMORY_CACHE.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    // Cache negatif kini membawa pesan error — klien tidak lagi gagal senyap
    return NextResponse.json({ ...hit.data, cached: true }, { status: hit.data.ok ? 200 : 502 });
  }

  let flight = IN_FLIGHT.get(cacheKey);
  if (!flight) {
    flight = queryMosques(lat, lng, radius, limit)
      .then((payload) => {
        MEMORY_CACHE.set(cacheKey, { data: payload, expiresAt: Date.now() + SUCCESS_TTL_MS });
        return payload;
      })
      .catch((e: Error) => {
        const data: FailurePayload = {
          ok: false,
          count: 0,
          mosques: [],
          error: e.message || "Layanan data masjid OpenStreetMap tidak dapat dijangkau",
        };
        MEMORY_CACHE.set(cacheKey, { data, expiresAt: Date.now() + FAILURE_TTL_MS });
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
