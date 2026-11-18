"use client";

/**
 * SplashGate — halaman pembuka sesuai mockup resmi AZANUSA:
 * background masjid senja, logo emas, tagline, empat fitur unggulan,
 * tombol "Mulai Sekarang". Tampil sekali per perangkat (localStorage).
 */

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ArrowRight, Bell, CalendarCheck2, MapPin, Volume2 } from "lucide-react";
import { azanPlayer } from "@/lib/audio/azan";

const SPLASH_KEY = "azanusa-splash-done";

const FEATURES: { icon: typeof Bell; label: string }[] = [
  { icon: CalendarCheck2, label: "Jadwal Akurat" },
  { icon: Volume2, label: "Azan Otomatis" },
  { icon: Bell, label: "Notifikasi Pengingat" },
  { icon: MapPin, label: "Seluruh Indonesia" },
];

export function SplashGate({ onFinish }: { onFinish: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  // Tampil sekali per perangkat; false saat SSR sehingga bebas hydration mismatch
  const needed = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(SPLASH_KEY) !== "1";
      } catch {
        return true;
      }
    },
    () => false
  );

  if (!needed || dismissed) return null;

  const start = () => {
    try {
      window.localStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // abaikan (mode privat)
    }
    // Gestur pertama: buka kunci audio agar azan bisa diputar nanti
    azanPlayer.unlock();
    setDismissed(true);
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-[#01322d]" role="dialog" aria-label="Selamat datang di AZANUSA">
      <Image
        src="/assets/azanusa-mosque-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[50%_38%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#01322d]/55 via-[#01322d]/45 to-[#01322d]/90" />
      <div className="relative flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
        <Image
          src="/assets/azanusa-logo-mark.png"
          alt="Logo AZANUSA"
          width={472}
          height={491}
          className="h-24 w-auto drop-shadow-[0_6px_24px_rgba(245,197,66,0.35)]"
          priority
        />
        <div>
          <h1 className="text-4xl font-extrabold tracking-wide text-white drop-shadow-md">
            AZAN<span className="text-gold">USA</span>
          </h1>
          <p className="mx-auto mt-2 max-w-[260px] text-sm font-medium leading-relaxed text-white/90">
            Jadwal Salat &amp; Pengingat Azan Seluruh Indonesia
          </p>
        </div>
        <div className="grid w-full max-w-sm grid-cols-4 gap-2.5">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="panel-teal flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl p-1.5"
            >
              <Icon className="h-5 w-5 text-gold" />
              <span className="text-[9.5px] font-semibold leading-tight text-white">{label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={start}
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ffd95c] to-[#f5c542] px-9 py-3 text-base font-extrabold text-[#01322d] shadow-xl transition hover:brightness-105 active:scale-[0.98]"
        >
          Mulai Sekarang
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
