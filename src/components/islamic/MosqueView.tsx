"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Navigation, Loader2, ExternalLink, MapPin } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { EmptyState } from "./CalendarView";

interface MosqueItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export function MosqueView() {
  const location = useAppStore((s) => s.location);
  const [items, setItems] = useState<MosqueItem[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async () => {
    if (!location) return;
    setState("loading");
    setError("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const query = `[out:json][timeout:20];node(around:3000,${location.lat},${location.lng})["amenity"="place_of_worship"]["religion"="muslim"];out center 30;`;
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`Layanan peta merespons ${res.status}`);
      const json = (await res.json()) as {
        elements: { id: number; lat: number; lon: number; tags?: Record<string, string> }[];
      };
      const list: MosqueItem[] = json.elements
        .map((e) => ({
          id: String(e.id),
          name: e.tags?.["name:en"] ?? e.tags?.name ?? "Masjid (nama tidak tercatat)",
          lat: e.lat,
          lng: e.lon,
          distanceKm: Math.round(
            2 * 6371 * Math.asin(
              Math.sqrt(
                Math.sin(((e.lat - location.lat) * Math.PI) / 360) ** 2 +
                  Math.cos((location.lat * Math.PI) / 180) *
                    Math.cos((e.lat * Math.PI) / 180) *
                    Math.sin(((e.lon - location.lng) * Math.PI) / 360) ** 2
              )
            )
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 20);
      setItems(list);
      setState(list.length ? "done" : "done");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState("error");
      setError(
        "Layanan data masjid (OpenStreetMap Overpass) sedang tidak dapat dijangkau. Coba lagi nanti."
      );
    }
  }, [location]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!location) {
    return (
      <EmptyState
        icon={Building2}
        title="Pencarian Masjid"
        text="Pilih wilayah terlebih dahulu untuk mencari masjid di sekitar koordinat wilayah Anda."
      />
    );
  }

  return (
    <div className="space-y-3">
      <section className="animate-fade-up rounded-2xl bg-gradient-to-br from-teal-deep to-emerald-az p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <Building2 className="h-9 w-9 text-gold-soft" />
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">Pencarian Masjid</h2>
            <p className="text-xs text-white/75">
              Masjid &amp; musala sekitar {location.name} (radius 3 km)
            </p>
          </div>
        </div>
        <button
          onClick={search}
          disabled={state === "loading"}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-teal-deep shadow transition hover:brightness-105 disabled:opacity-60"
        >
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {state === "loading" ? "Mencari masjid…" : items ? "Muat ulang" : "Cari masjid terdekat"}
        </button>
      </section>

      {state === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {state === "idle" && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Data masjid bersumber dari OpenStreetMap (kontribusi publik). Untuk wilayah
          dengan data OSM terbatas, hasil bisa lebih sedikit dari yang sebenarnya.
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
                  ~{m.distanceKm < 1 ? `${Math.round(m.distanceKm * 1000)} m` : `${m.distanceKm} km`} dari pusat wilayah
                </span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          ))}
          <p className="px-1 text-[10px] text-muted-foreground">
            © Kontributor OpenStreetMap. Rute dibuka dengan aplikasi peta perangkat.
          </p>
        </section>
      )}
    </div>
  );
}
