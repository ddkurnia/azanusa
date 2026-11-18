import regionsData from "@/data/regions.json";
import type { Province, Region } from "@/types";

const provinces = (regionsData.provinces as Province[]).slice();
const regencies = (regionsData.regencies as Region[]).slice();

export function getAllProvinces(): Province[] {
  return provinces;
}

export function getAllRegencies(): Region[] {
  return regencies;
}

export function getRegionByCode(code: string): Region | null {
  return regencies.find((r) => r.code === code) ?? null;
}

/** Pencarian wilayah: cocokkan awalan/substring pada nama kab/kota & provinsi */
export function searchRegions(query: string, limit = 25): Region[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { region: Region; score: number }[] = [];
  for (const r of regencies) {
    const name = r.name.toLowerCase();
    const prov = r.prov.toLowerCase();
    const bare = name.replace(/^(kabupaten|kota)\s+administrasi\s+/i, "").replace(/^(kabupaten|kota)\s+/i, "");
    let score = -1;
    if (bare.startsWith(q)) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (bare.includes(q)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (prov.startsWith(q)) score = 4;
    else if (prov.includes(q)) score = 5;
    if (score >= 0) scored.push({ region: r, score });
  }
  scored.sort((a, b) => a.score - b.score || a.region.name.localeCompare(b.region.name, "id"));
  return scored.slice(0, limit).map((s) => s.region);
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Wilayah terdekat dari koordinat perangkat (untuk deteksi lokasi otomatis) */
export function nearestRegion(lat: number, lng: number): { region: Region; distanceKm: number } {
  let best = regencies[0];
  let bestDist = Infinity;
  for (const r of regencies) {
    const d = haversine(lat, lng, r.lat, r.lng);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return { region: best, distanceKm: Math.round(bestDist) };
}

export { regionsData };
