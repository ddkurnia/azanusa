"use client";

/**
 * NextPrayerCard — kartu hitung mundur azan sesuai mockup:
 * label "Menuju Waktu", nama salat berikutnya, countdown emas realtime,
 * tombol audio bulat (play/pause azan nyata).
 * Kartu ini DI-RENDER DI DALAM hero (MosqueHero) dan menumpuk di atas
 * gambar masjid memakai panel-teal-glass: dark teal semi-transparan,
 * border hijau lembut, blur halus — bangunan masjid tetap terlihat di belakangnya.
 */

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import type { TimeZoneId } from "@/types";
import { PRAYER_NAMES } from "@/types";
import { azanPlayer } from "@/lib/audio/azan";
import { useNow } from "@/hooks/use-now";
import { formatCountdown, tzLabelOf, type NextInfo } from "@/lib/prayer/display";

export function NextPrayerCard({
  next,
  timezone,
}: {
  next: NextInfo | null;
  timezone: TimeZoneId;
}) {
  const now = useNow(1000);
  const [playing, setPlaying] = useState(false);

  // Status pemutar mengikuti peristiwa nyata: klik tombol & audio selesai
  useEffect(() => {
    azanPlayer.onEnded = () => setPlaying(false);
    return () => {
      azanPlayer.onEnded = null;
    };
  }, []);

  const countdown = next ? formatCountdown(Date.parse(next.utcISO) - now.getTime()) : "--:--:--";

  const toggleAudio = async () => {
    if (azanPlayer.isPlaying()) {
      azanPlayer.pause();
      setPlaying(false);
      return;
    }
    // Gestur pengguna: buka kunci audio lalu putar (kebijakan autoplay browser)
    if (!azanPlayer.isUnlocked()) await azanPlayer.unlock();
    await azanPlayer.playAzan();
    setPlaying(azanPlayer.isPlaying());
  };

  return (
    <section
      className="panel-teal-glass rounded-3xl p-4"
      /*
        CLEAR GLASSMORPHISM: lapisan hijau tipis 22% ada di class
        .panel-teal-glass (globals.css). backdrop-filter di-set inline agar
        TIDAK dipangkas minifier CSS produksi (Lightning CSS) — blur rendah
        3px agar gambar masjid di belakang kartu tetap jernih.
      */
      style={{
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
            Menuju Waktu
          </p>
          <h2 className="mt-0.5 truncate text-[26px] font-extrabold leading-tight text-white sm:text-3xl">
            {next ? `${PRAYER_NAMES[next.key]}${next.tomorrow ? " (Besok)" : ""}` : "—"}
          </h2>
          {next && (
            <p className="mt-0.5 text-xs font-semibold text-white/70">
              {next.display} {tzLabelOf(timezone)}
            </p>
          )}
          <div className="mt-2.5 inline-flex items-center rounded-full bg-gradient-to-b from-[#ffd95c] to-[#f5c542] px-4 py-1.5 shadow-md">
            <span className="font-num-tabular text-lg font-extrabold tracking-wide text-[#01322d]">
              − {countdown}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            onClick={toggleAudio}
            className={`flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-gold/80 bg-gradient-to-b from-[#1aa88e] to-[#0b6c5d] shadow-lg transition hover:brightness-110 ${
              playing ? "animate-pulse-ring" : ""
            }`}
            aria-label={playing ? "Jeda azan" : "Putar azan"}
            aria-pressed={playing}
          >
            {playing ? (
              <Square className="h-5 w-5 fill-white text-white" />
            ) : (
              <Volume2 className="h-6 w-6 text-white" />
            )}
          </button>
          <span className="text-[11px] font-bold text-white/85">
            {playing ? "Jeda Azan" : "Putar Azan"}
          </span>
        </div>
      </div>
    </section>
  );
}
