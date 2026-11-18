/**
 * Arah kiblat: azimut bulatan besar dari titik koordinat ke Ka'bah
 * (21.422487, 39.826206 — Masjidil Haram, Makkah).
 * Rumus: theta = atan2(sin(Δλ), cos(φ1)·tan(φ2) − sin(φ1)·cos(Δλ))
 */
export const KAABA_LAT = 21.422487;
export const KAABA_LNG = 39.826206;

/** Azimut kiblat dalam derajat dari utara sejati (0-360) */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = (lat * Math.PI) / 180;
  const φ2 = (KAABA_LAT * Math.PI) / 180;
  const Δλ = ((lng - KAABA_LNG) * Math.PI) / 180;
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/** Jarak garis lurus ke Ka'bah (km) */
export function distanceToKaabaKm(lat: number, lng: number): number {
  const R = 6371;
  const φ1 = (lat * Math.PI) / 180;
  const φ2 = (KAABA_LAT * Math.PI) / 180;
  const Δφ = (KAABA_LAT - lat) * (Math.PI / 180);
  const Δλ = (KAABA_LNG - lng) * (Math.PI / 180);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Kompas arah mata angok Indonesia untuk suatu derajat */
export function compassDirection(deg: number): string {
  const dirs = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
  return dirs[Math.round(deg / 45) % 8];
}
