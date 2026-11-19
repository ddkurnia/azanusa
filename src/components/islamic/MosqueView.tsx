"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Navigation, Loader2, ExternalLink, MapPin, LocateFixed } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { EmptyState } from "./CalendarView";

interface MosqueItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

type Origin = "wilayah" | "gps";

export function MosqueView() {
  const location = useAppStore((s) => s.location);
  const [items, setItems] = useState<MosqueItem[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "gps" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState<Origin>("wilayah");
  const abortRef = useRef<AbortController | null>(null);
  const geoAbortRef = useRef<number | null>(null);

  const search = useCallback(
    async (lat: number, lng: number, src: Origin) => {
      setState(src === "gps" ? "gps" : "loading");
      setError("");
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(
          `/api/mosques?lat=${lat}&lng=${lng}&radius=3000&limit=30`,
          { signal: ac.signal }
        );
        const json = (await res.json()) as {
          ok: boolean;
          count?: number;
          mosques?: MosqueItem[];
          error?: string;
        };
        if (!json.ok) throw new Error(json.error ?? "Pencarian gagal");
        setItems(json.mosques ?? []);
        setOrigin(src);
        setState("done");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState("error");
        setError(
          (e as Error).message ||
            "Layanan data masjid (OpenStreetMap Overpass) sedang tidak dapat dijangkau. Coba lagi nanti."
        );
      }
    },
    []
  );

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
    if (geoAbortRef.current !== null) navigator.geolocation.clearWatch(geoAbortRef.current);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoAbortRef.current = null;
        search(pos.coords.latitude, pos.coords.longitude, "gps");
      },
      (err) => {
        geoAbortRef.current = null;
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
      if (geoAbortRef.current !== null) navigator.geolocation.clearWatch(geoAbortRef.current);
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
                  ? "Masjid & musala sekitar lokasi Anda (GPS) — radius 3 km"
                  : `Masjid & musala sekitar ${location.name} (radius 3 km)`}
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

      {state === "idle" && (
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
              Belum ada masjid tercatat di OpenStreetMap untuk radius ini.
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
            © Kontributor OpenStreetMap — data realtime via AZANUSA API. Rute dibuka dengan
            aplikasi peta perangkat.
          </p>
        </section>
      )}
    </div>
  );
}
