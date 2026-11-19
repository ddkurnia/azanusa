/**
 * Util bersama pencarian masjid — dipakai oleh MosqueView (klien) dan
 * /api/mosques (proxy server).
 *
 * KUNCI DETEKSI: kueri Overpass TIDAK mensyaratkan tag "religion=muslim"
 * karena mayoritas data masjid di OpenStreetMap Indonesia hanya berisi
 * amenity=place_of_worship + nama ("Masjid…") atau building=mosque tanpa
 * tag religion. Kueri mengambil SEMUA tempat ibadah di sekitar koordinat,
 * lalu penyaringan "indikasi muslim" dilakukan di JS (fungsi overpassToMosques).
 */

export interface MosqueItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

/** Mirror Overpass dengan CORS (dapat dipanggil langsung dari browser). */
export const OVERPASS_CLIENT_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

/** Mirror tambahan untuk pemakaian server (tanpa syarat CORS). */
export const OVERPASS_SERVER_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * toRad) / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(((lng2 - lng1) * toRad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * Kueri luas: semua amenity=place_of_worship + bangunan bertag
 * mosque/musalla (node & way). Penyaringan agama dilakukan di JS.
 */
export function buildOverpassQuery(lat: number, lng: number, radius: number, maxElements: number): string {
  const r = Math.round(radius);
  return (
    `[out:json][timeout:20];` +
    `(node(around:${r},${lat},${lng})["amenity"="place_of_worship"];` +
    `way(around:${r},${lat},${lng})["amenity"="place_of_worship"];` +
    `node(around:${r},${lat},${lng})["building"~"^(mosque|musalla|musola|musollah|musala)$"];` +
    `way(around:${r},${lat},${lng})["building"~"^(mosque|musalla|musola|musollah|musala)$"];);` +
    `out center ${Math.min(120, maxElements)};`
  );
}

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const MUSLIM_RELIGION = new Set(["muslim", "islamic", "islam", "moslem"]);
const MUSLIM_BUILDING = new Set(["mosque", "musalla", "musola", "musollah", "musala", "surau", "langgar"]);
// Nama khas muslim — dipakai hanya bila tag religion hilang
const MUSLIM_NAME_RE =
  /masjid|mesjid|musala|musalla|mushola|musholla|musolla|surau|langgar|meunasah|dayah|jami['’ ]|jame['’ ]|quba|istiqamah|istiqomah|taqwa|ikhlas|rahmat|rahmah|falah|baiturrah|baiturrahm|baitul|nurul|hidayah|muttaqin|mukmin|syuhada|mujahidin|nabawi|aqsa|al-akbar|grand mosque|al-azhar|istiqlal/i;
// Nama khas NON-muslim — membatalkan kecurigaan bila tag religion hilang
const NON_MUSLIM_NAME_RE = /gereja|church|katedral|cathedral|paroki|kapel|klenteng|vihara|wihara|pura|candi|gurdwara|synagogue|sinagoga/i;
const MUSLIM_DENOMINATION = /islam|sunni|shia|syiah|ahmadi|muhammadiyah|nahdlatul|sufi|salafi/i;

/** True bila element Overpass punya indikasi kuat sebagai masjid/musala. */
function isMuslimPlace(tags: Record<string, string>): boolean {
  const religion = (tags["religion"] ?? "").toLowerCase();
  if (religion) return MUSLIM_RELIGION.has(religion); // tag religion ada → jadi patokan mutlak
  const building = (tags["building"] ?? "").toLowerCase();
  const denomination = (tags["denomination"] ?? "").toLowerCase();
  const name = `${tags["name:en"] ?? ""}|${tags["name"] ?? ""}|${tags["alt_name"] ?? ""}`;
  if (NON_MUSLIM_NAME_RE.test(name)) return false;
  if (MUSLIM_BUILDING.has(building)) return true;
  if (denomination && MUSLIM_DENOMINATION.test(denomination)) return true;
  return MUSLIM_NAME_RE.test(name);
}

/**
 * Ubah respons Overpass menjadi daftar masjid: saring indikasi muslim,
 * dedupe node/way ganda, urutkan jarak terdekat, batasi jumlah.
 */
export function overpassToMosques(
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
      const tags = e.tags ?? {};
      if (!isMuslimPlace(tags)) return null;
      const rawName = tags["name:en"] ?? tags["name"] ?? "";
      return {
        id: `${e.type}/${e.id}`,
        name: rawName || "Masjid/musala (nama tidak tercatat)",
        lat: mlat as number,
        lng: mlng as number,
        distanceKm: haversineKm(lat, lng, mlat as number, mlng as number),
      } as MosqueItem;
    })
    .filter((m): m is MosqueItem => m !== null)
    .filter((m) => {
      // Dedupe: nama + koordinat 4 desimal (~11 m) untuk node & way yang sama
      const k = `${m.name}|${m.lat.toFixed(4)}|${m.lng.toFixed(4)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/* ---------------------------------- Photon ----------------------------------
 * Photon (Komoot) adalah layanan geokoding OSM yang ramah IP datacenter dan
 * browser (CORS aktif) — dijadikan LAPIS CADANGAN ketika mirror Overpass
 * gagal/tidak dapat dijangkau. Pencarian dilakukan per kata kunci nama
 * ("masjid", "musala", …) dalam bbox di sekitar koordinat, karena Photon
 * tidak menyediakan pencarian radius per tag.
 * --------------------------------------------------------------------------- */

export const PHOTON_BASE = "https://photon.komoot.io/api";

export const PHOTON_TERMS = ["masjid", "mesjid", "musala", "musholla", "surau"] as const;

/** bbox Photon "minLon,minLat,maxLon,maxLat" untuk radius meter di sekitar titik. */
export function photonBbox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const minLat = Math.max(-90, lat - dLat);
  const maxLat = Math.min(90, lat + dLat);
  let minLng = lng - dLng;
  let maxLng = lng + dLng;
  if (minLng < -180) minLng = -180;
  if (maxLng > 180) maxLng = 180;
  return `${minLng.toFixed(5)},${minLat.toFixed(5)},${maxLng.toFixed(5)},${maxLat.toFixed(5)}`;
}

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    [k: string]: unknown;
  };
}

/** Ubah hasil Photon menjadi daftar masjid (hanya amenity=place_of_worship). */
export function photonToMosques(
  features: PhotonFeature[],
  lat: number,
  lng: number,
  limit: number
): MosqueItem[] {
  const seen = new Set<string>();
  const out: MosqueItem[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const c = f.geometry?.coordinates;
    const name = p.name ?? "";
    if (!c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    // Hanya tempat ibadah / bangunan masjid — bukan jalan/kampung bernama "Masjid"
    const isPow = p.osm_key === "amenity" && p.osm_value === "place_of_worship";
    const isMosqueBuilding = p.osm_key === "building" && p.osm_value === "mosque";
    if (!isPow && !isMosqueBuilding) continue;
    if (!name) continue; // tanpa nama tidak bisa dipastikan masjid via Photon
    const key = p.osm_id ? `${p.osm_type ?? "n"}/${p.osm_id}` : `${name}|${c[1].toFixed(4)}|${c[0].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key,
      name,
      lat: c[1],
      lng: c[0],
      distanceKm: haversineKm(lat, lng, c[1], c[0]),
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
}
