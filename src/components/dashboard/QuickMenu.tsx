"use client";

/**
 * QuickMenu — empat kartu akses cepat sesuai mockup:
 * Kalender Hijriah, Arah Kiblat, Doa Harian, Lainnya.
 */

import { CalendarDays, Compass, HandHeart, LayoutGrid } from "lucide-react";
import type { ViewKey } from "@/hooks/use-hash-route";

const ITEMS: { key: ViewKey; label: string; icon: typeof Compass }[] = [
  { key: "kalender", label: "Kalender Hijriah", icon: CalendarDays },
  { key: "kiblat", label: "Arah Kiblat", icon: Compass },
  { key: "doa", label: "Doa Harian", icon: HandHeart },
  { key: "lainnya", label: "Lainnya", icon: LayoutGrid },
];

export function QuickMenu({ navigate }: { navigate: (v: ViewKey) => void }) {
  return (
    <section className="animate-fade-up">
      <div className="grid grid-cols-4 gap-2.5">
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => navigate(key)}
            className="panel-teal flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center shadow-md shadow-black/20 transition hover:brightness-110"
          >
            <Icon className="h-6 w-6 text-gold" />
            <span className="text-[10.5px] font-semibold leading-tight text-white">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
