"use client";

/**
 * AppHeader — header aplikasi AZANUSA sesuai mockup resmi:
 * logo di kiri, ikon notifikasi di kanan, ikon pengaturan paling kanan.
 * Latar teal gelap menyatu dengan dashboard.
 */

import Image from "next/image";
import { Bell, Settings } from "lucide-react";
import type { ViewKey } from "@/hooks/use-hash-route";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";

export function AppHeader({ navigate }: { navigate: (v: ViewKey) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#01322d]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-2.5">
        <button
          onClick={() => navigate("beranda")}
          className="flex min-w-0 items-center gap-2"
          aria-label="Beranda AZANUSA"
        >
          <Image
            src="/assets/azanusa-logo-mark.png"
            alt="Logo AZANUSA"
            width={472}
            height={491}
            className="h-[30px] w-auto shrink-0"
            priority
          />
          <span className="truncate text-lg font-extrabold tracking-wide text-white">
            AZAN<span className="text-gold">USA</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => navigate("pengaturan")}
            className="rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label="Pengaturan notifikasi"
            title="Pengaturan notifikasi"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate("pengaturan")}
            className="rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label="Pengaturan"
            title="Pengaturan"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
      <OfflineBanner />
    </header>
  );
}
