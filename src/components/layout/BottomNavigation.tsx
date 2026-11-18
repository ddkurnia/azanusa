"use client";

/**
 * BottomNavigation — navigasi bawah lima menu sesuai mockup:
 * Beranda, Jadwal, Al-Qur'an, Masjid, Profil.
 * Latar putih, ikon gelap, menu aktif hijau teal, safe-area Android.
 */

import { Home, CalendarDays, BookOpen, Landmark, User } from "lucide-react";
import type { ViewKey } from "@/hooks/use-hash-route";

const ITEMS: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "jadwal", label: "Jadwal", icon: CalendarDays },
  { key: "alquran", label: "Al-Qur'an", icon: BookOpen },
  { key: "masjid", label: "Masjid", icon: Landmark },
  { key: "profil", label: "Profil", icon: User },
];

export function BottomNavigation({ view, navigate }: { view: ViewKey; navigate: (v: ViewKey) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigasi utama"
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-stretch justify-around rounded-t-2xl border-t border-black/5 bg-white px-1 shadow-[0_-8px_28px_rgba(0,0,0,0.22)]">
          {ITEMS.map(({ key, label, icon: Icon }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => navigate(key)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition ${
                  active ? "text-[#087c70]" : "text-[#4d5c56] hover:text-[#087c70]"
                }`}
              >
                <Icon className={`h-[22px] w-[22px] ${active ? "fill-[#087c70]/15" : ""}`} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
