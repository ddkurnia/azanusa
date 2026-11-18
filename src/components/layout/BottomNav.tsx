"use client";

import { Home, CalendarDays, Building2, User } from "lucide-react";
import type { ViewKey } from "@/hooks/use-hash-route";

const ITEMS: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "jadwal", label: "Jadwal", icon: CalendarDays },
  { key: "masjid", label: "Masjid", icon: Building2 },
  { key: "profil", label: "Profil", icon: User },
];

export function BottomNav({ view, navigate }: { view: ViewKey; navigate: (v: ViewKey) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigasi utama"
    >
      <div className="mx-auto flex w-full max-w-xl items-stretch justify-around px-2 py-1.5">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[52px] min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition ${
                active ? "bg-emerald-soft text-primary" : "text-muted-foreground hover:text-primary"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
