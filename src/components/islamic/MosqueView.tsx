"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Navigation, Loader2, ExternalLink, MapPin, LocateFixed } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  MosqueItem,
  OVERPASS_CLIENT_MIRRORS,
  PHOTON_BASE,
  PHOTON_TERMS,
  buildOverpassQuery,
  overpassToMosques,
  photonBbox,
  photonToMosques,
  type OverpassElement,
  type PhotonFeature,
} from "@/lib/mosques";
import { EmptyState } from "./CalendarView";

type Origin = "wilayah" | "gps";
type Source = "device" | "photon" | "proxy";

/**
 * Pencarian masjid realtime dari OpenStreetMap.
 *
 * Strategi berlapis agar tahan gangguan:
 *  1. Langsung dari perangkat: cascade mirror Overpass satu per satu
 *     (sopan, tanpa kueri paralel identik), timeout 6 dtk per mirror.
 *  2. Langsung dari perangkat via Photon (Komoot, CORS aktif): bila semua
 *     mirror Overpass gagal dari jaringan pengguna.
 *  3. Pencadang terakhir: proxy server AZANUSA /api/mosques
 *     (Overpass round-robin + Photon, cache, pesan error eksplisit).
 *  4. Radius diperluas otomatis 3 km → 10 km bila hasil kosong (data OSM
 *     di banyak wilayah Indonesia masih terbatas).
 */

async function fetchFromServer(lat: number, lng: number, radius: number): Promise<MosqueItem[]> {
  const res = await fetch(`/api/mosques?lat=${lat}&lng=${lng}&radius=${radius}&limit=30`, {
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await res.json()) as { ok?: boolean; mosques?: MosqueItem[]; error?: string };
  if (!json.ok) throw new Error(json.error ?? `Proxy server gagal (HTTP ${res.status})`);
  return json.mosques ?? [];
}

/** Cascade mirror dari perangkat: satu per satu, mirror sehat pertama menang. */
async function fetchFromDevice(lat: number, lng: number, radius: number): Promise<MosqueItem[]> {
  const query = buildOverpassQuery(lat, lng, radius, 90);
  const errors: string[] = [];
  for (const url of OVERPASS_CLIENT_MIRRORS.slice(0, 4)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return overpassToMosques(json, lat, lng, 30);
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join("; ") || "Semua mirror Overpass tidak dapat dijangkau");
}

/** Lapis 2 dari perangkat — Photon (Komoot): pencarian nama dalam bbox. */
async function fetchPhotonFromDevice(lat: number, lng: number, radius: number): Promise<MosqueItem[]> {
  const bbox = photonBbox(lat, lng, radius);
  const requests = PHOTON_TERMS.map((term) =>
    fetch(`${PHOTON_BASE}?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lng}&bbox=${encodeURIComponent(bbox)}&limit=50`, {
      signal: AbortSignal.timeout(8_000),
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ features?: PhotonFeature[] }>) : null))
      .catch(() => null)
  );
  const results = await Promise.all(requests);
  const features = results.flatMap((r) => r?.features ?? []);
  const mosques = photonToMosques(features, lat, lng, 30);
  if (features.length === 0) throw new Error("Photon tidak dapat dijangkau dari perangkat");
  return mosques;
}

export function MosqueView() {
  const location = useAppStore((s) => s.location);
  const [items, setItems] = useState<MosqueItem[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "gps" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState<Origin>("wilayah");
  const [source, setSource] = useState<Source | null>(null);
  const [radius, setRadius] = useState(3000);
  const [radiusNote, setRadiusNote] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  // Cache hasil sesi ini per (koordinat, radius) — buka ulang halaman instan
  const resultCache = useRef<Map<string, MosqueItem[]>>(new Map());

  const search = useCallback(async (lat: number, lng: number, src: Origin) => {
    setState(src === "gps" ? "gps" : "loading");
    setError("");
    setRadiusNote("");
    setSource(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Eskalasi radius: 3 km dulu; kalau kosong, coba 10 km
      for (const r of [3000, 10_000]) {
        const key = `${lat.toFixed(3)},${lng.toFixed(3)},${r}`;
        const cached = resultCache.current.get(key);
        if (cached) {
          if (cached.length === 0 && r === 3000) continue; // cache kosong → langsung eskalasi
          setItems(cached);
          setOrigin(src);
          setSource(null);
          setRadius(r);
          if (r === 10_000) setRadiusNote("Radius diperluas ke 10 km karena tidak ada data pada radius 3 km.");
          setState("done");
          return;
        }
        setRadius(r);
        if (r === 10_000) setRadiusNote("Tidak ada masjid tercatat pada radius 3 km — memperluas ke 10 km…");

        // 1) Utama: Overpass langsung dari perangkat → 2) Photon → 3) proxy
        let list: MosqueItem[];
        let via: Source = "device";
        try {
          list = await fetchFromDevice(lat, lng, r);
        } catch (directErr) {
          if ((directErr as Error).name === "AbortError" || ac.signal.aborted) return;
          try {
            list = await fetchPhotonFromDevice(lat, lng, r);
            via = "photon";
          } catch (photonErr) {
            if ((photonErr as Error).name === "AbortError" || ac.signal.aborted) return;
            // 3) Pencadang terakhir: proxy server AZANUSA
            list = await fetchFromServer(lat, lng, r);
            via = "proxy";
          }
        }
        if (ac.signal.aborted) return;

        resultCache.current.set(key, list);
        if (list.length > 0 || r === 10_000) {
          setItems(list);
          setOrigin(src);
          setSource(via);
          setRadiusNote(r === 10_000 ? "Radius diperluas ke 10 km karena tidak ada data pada radius 3 km." : "");
          setState("done");
          return;
        }
        // list kosong pada 3 km → lanjut eskalasi ke 10 km
      }
    } catch (e) {
      if ((e as Error).name === "AbortError" || ac.signal.aborted) return;
      setState("error");
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg && !msg.includes("HTTP") && !msg.includes("fetch") && !msg.includes("mirror")
          ? msg
          : "Layanan data masjid (OpenStreetMap Overpass) sedang tidak dapat dijangkau dari perangkat maupun server. Coba lagi beberapa saat lagi."
      );
    }
  }, []);

  // Realtime: cari otomatis saat halaman dibuka / wilayah berganti
  const autoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!location) return;
    const key = `${location.code}`;
    if (autoRef.current === key) return;
    autoRef.current = key;
    search(location.lat, location.lng, "wilayah");
  }, [location, search]);

  // Realtime GPS: cari di sekitar posisi pengguna sebenarnya
  const searchGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState("error");
      setError("Perangkat tidak mendukung Geolocation. Gunakan pencarian berdasarkan wilayah.");
      return;
    }
    setState("gps");
    setError("");
    if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoWatchRef.current = null;
        search(pos.coords.latitude, pos.coords.longitude, "gps");
      },
      (err) => {
        geoWatchRef.current = null;
        // Gagal GPS (ditolak/tidak tersedia) — jatuh ke pusat wilayah yang dipilih
        if (location) {
          search(location.lat, location.lng, "wilayah");
        } else {
          setState("error");
          setError(
            err.code === err.PERMISSION_DENIED
              ? "Izin lokasi ditolak. Aktifkan izin lokasi di browser untuk mencari masjid di sekitar Anda, atau cari berdasarkan wilayah."
              : "Lokasi GPS tidak dapat ditentukan. Coba lagi atau cari berdasarkan wilayah."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }, [location, search]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    },
    []
  );

  if (!location) {
    return (
      <EmptyState
        icon={Building2}
        title="Pencarian Masjid"
        text="Pilih wilayah terlebih dahulu untuk mencari masjid di sekitar koordinat wilayah Anda."
      />
    );
  }

  const busy = state === "loading" || state === "gps";
  const radiusKm = radius / 1000;

  return (
    <div className="space-y-3">
      <section className="animate-fade-up rounded-2xl bg-gradient-to-br from-teal-deep to-emerald-az p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <Building2 className="h-9 w-9 text-gold-soft" />
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">Pencarian Masjid</h2>
            <p className="text-xs text-white/75">
              {state === "gps"
                ? "Menentukan lokasi Anda…"
                : origin === "gps"
                  ? `Masjid & musala sekitar lokasi Anda (GPS) — radius ${radiusKm} km`
                  : `Masjid & musala sekitar ${location.name} (radius ${radiusKm} km)`}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={searchGps}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-teal-deep shadow transition hover:brightness-105 disabled:opacity-60"
          >
            {state === "gps" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            {state === "gps" ? "Mendeteksi lokasi…" : "Lokasi saya (GPS)"}
          </button>
          <button
            onClick={() => search(location.lat, location.lng, "wilayah")}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {state === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {origin === "gps" ? "Pusat wilayah" : items ? "Muat ulang" : "Cari masjid"}
          </button>
        </div>
      </section>

      {state === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {radiusNote && state !== "error" && (
        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {radiusNote}
        </p>
      )}

      {state === "idle" && !radiusNote && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Data masjid bersumber dari OpenStreetMap (kontribusi publik), diperbarui langsung
          setiap kali Anda membuka halaman ini. Untuk wilayah dengan data OSM terbatas, hasil
          bisa lebih sedikit dari yang sebenarnya.
        </p>
      )}

      {items && state !== "error" && (
        <section className="space-y-2">
          {items.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Tidak ada masjid tercatat di OpenStreetMap dalam radius {radiusKm} km.
              {origin === "gps"
                ? " Coba tombol Muat ulang beberapa saat lagi, atau gunakan pusat wilayah."
                : " Aktifkan Lokasi saya (GPS) agar pencarian mengikuti posisi Anda sebenarnya."}
            </div>
          )}
          {items.map((m) => (
            <a
              key={m.id}
              href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-soft text-primary">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-teal-deep">{m.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  ~{m.distanceKm < 1 ? `${Math.round(m.distanceKm * 1000)} m` : `${m.distanceKm} km`}{" "}
                  {origin === "gps" ? "dari Anda" : "dari pusat wilayah"}
                </span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          ))}
          <p className="px-1 text-[10px] text-muted-foreground">
            © Kontributor OpenStreetMap — data realtime{" "}
            {source === "proxy"
              ? "melalui proxy server AZANUSA"
              : source === "photon"
                ? "langsung dari perangkat (layanan Photon)"
                : "langsung dari perangkat (Overpass)"}
            . Rute dibuka dengan aplikasi peta perangkat.
          </p>
        </section>
      )}
    </div>
  );
}
