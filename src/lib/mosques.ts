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
