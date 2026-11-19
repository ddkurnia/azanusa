"use client";

/**
 * LocationHeader — lokasi aktif + tanggal Masehi & Hijriah sesuai mockup.
 * Dirender DI DALAM hero (di atas gambar masjid), dengan bayangan teks halus
 * agar tetap mudah dibaca. Cuaca tidak ditampilkan karena integrasi data
 * cuaca belum tersedia (tidak boleh menampilkan data palsu).
 */

import { ChevronDown, MapPin } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useNow } from "@/hooks/use-now";
import { longDateInTz } from "@/lib/timezone";
import { formatHijri, hijriDateInTz } from "@/lib/hijri";
import { tzLabelOf } from "@/lib/prayer/display";

export function LocationHeader({ onOpenLocation }: { onOpenLocation: () => void }) {
  const location = useAppStore((s) => s.location);
  const now = useNow(30_000);
  const tz = location?.tz ?? "Asia/Jakarta";

  if (!location) return null;

  return (
    <section className="text-shadow-soft px-4 pb-1 pt-3 text-white">
      <button
        onClick={onOpenLocation}
        className="group flex max-w-full items-center gap-2 text-left"
        aria-label={`Lokasi ${location.name}, ${location.prov}. Ketuk untuk mengganti`}
      >
        <MapPin className="h-4.5 w-4.5 shrink-0 text-gold" />
        <span className="truncate text-[15px] font-bold">
          {location.name}
          <span className="font-semibold text-white/75">, {location.prov}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/70 transition group-hover:text-gold" />
      </button>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{longDateInTz(now, tz)}</p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {formatHijri(hijriDateInTz(now, tz))}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/80">
          {tzLabelOf(tz)}
        </span>
      </div>
    </section>
  );
}
