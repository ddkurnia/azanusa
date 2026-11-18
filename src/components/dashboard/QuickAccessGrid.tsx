"use client";

import { CalendarDays, Compass, BookOpenText, CircleDot, Building2, Settings } from "lucide-react";
import type { ViewKey } from "@/hooks/use-hash-route";

const ITEMS: { key: ViewKey; label: string; icon: typeof Compass }[] = [
  { key: "kalender", label: "Kalender Hijriah", icon: CalendarDays },
  { key: "kiblat", label: "Arah Kiblat", icon: Compass },
  { key: "doa", label: "Doa Harian", icon: BookOpenText },
  { key: "zikir", label: "Zikir", icon: CircleDot },
  { key: "masjid", label: "Pencarian Masjid", icon: Building2 },
  { key: "pengaturan", label: "Pengaturan", icon: Settings },
];

export function QuickAccessGrid({ navigate }: { navigate: (v: ViewKey) => void }) {
  return (
    <section className="animate-fade-up">
      <h3 className="mb-2 px-1 text-sm font-bold text-teal-deep">Akses Cepat</h3>
      <div className="grid grid-cols-3 gap-2">
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => navigate(key)}
            className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-2 text-center shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-soft text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
