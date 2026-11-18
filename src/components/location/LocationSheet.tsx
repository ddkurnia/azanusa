"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Navigation, Loader2, CircleDashed } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Region } from "@/types";

interface SearchItem extends Region {
  distanceKm?: number;
}

export function LocationSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">("idle");
  const [geoError, setGeoError] = useState("");
  const setLocation = useAppStore((s) => s.setLocation);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/locations?q=${encodeURIComponent(query)}&limit=30`)
      .then((r) => r.json())
      .then((j) => setResults(j.ok ? (j.results as SearchItem[]) : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open, runSearch]);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      setGeoError("Perangkat tidak mendukung Geolocation.");
      return;
    }
    setGeoState("locating");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/locations?lat=${pos.coords.latitude.toFixed(5)}&lng=${pos.coords.longitude.toFixed(5)}`
          );
          const j = await res.json();
          if (j.ok && j.results?.length) {
            const item = j.results[0] as SearchItem;
            setLocation({
              code: item.code,
              name: item.name,
              prov: item.prov,
              provCode: item.provCode,
              tz: item.tz,
              lat: item.lat,
              lng: item.lng,
            });
            onOpenChange(false);
          } else {
            throw new Error("Wilayah tidak ditemukan");
          }
        } catch (e) {
          setGeoState("error");
          setGeoError((e as Error).message);
        } finally {
          setGeoState("idle");
        }
      },
      (err) => {
        setGeoState("error");
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Cari wilayah secara manual di bawah."
            : "Lokasi tidak dapat dideteksi. Coba cari wilayah secara manual."
        );
        setGeoState("idle");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  };

  const pick = (item: SearchItem) => {
    setLocation({
      code: item.code,
      name: item.name,
      prov: item.prov,
      provCode: item.provCode,
      tz: item.tz,
      lat: item.lat,
      lng: item.lng,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-2xl bg-card p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base font-bold text-teal-deep">Pilih Wilayah</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-4 py-3">
          <button
            onClick={useMyLocation}
            className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-emerald-soft px-4 py-3 text-left transition hover:brightness-105"
          >
            {geoState === "locating" ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Navigation className="h-5 w-5 text-primary" />
            )}
            <span className="flex-1">
              <span className="block text-sm font-bold text-primary">Gunakan lokasi saya</span>
              <span className="block text-[11px] text-muted-foreground">
                Deteksi otomatis wilayah terdekat (butuh izin lokasi)
              </span>
            </span>
          </button>
          {geoError && <p className="text-xs text-destructive">{geoError}</p>}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kabupaten/kota atau provinsi…"
              className="pl-9"
              aria-label="Cari wilayah"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="nice-scroll max-h-72 overflow-y-auto rounded-xl border border-border">
            {q.trim() && !loading && results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Wilayah tidak ditemukan. Coba kata kunci lain, misalnya &quot;Bandung&quot; atau &quot;Makassar&quot;.
              </p>
            )}
            {!q.trim() && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Ketik nama wilayah — mencakup 38 provinsi dan 514 kabupaten/kota se-Indonesia.
              </p>
            )}
            {results.map((r) => (
              <button
                key={r.code}
                onClick={() => pick(r)}
                className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-secondary"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {r.prov}
                    {r.distanceKm !== undefined ? ` · ~${r.distanceKm} km dari Anda` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                  {r.tz === "Asia/Jakarta" ? "WIB" : r.tz === "Asia/Makassar" ? "WITA" : "WIT"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Kecamatan belum tersedia pada versi ini. Zona waktu ditentukan otomatis dari wilayah: WIB
            (Sumatera, Jawa, Kalbar-Kalteng), WITA (Bali–Sulawesi, Kalsel-Kaltim-Kaltara), WIT (Maluku, Papua).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
