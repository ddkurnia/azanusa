"use client";

/**
 * HomeView — dashboard AZANUSA sesuai mockup resmi:
 * SATU section hero (MosqueHero) berisi gambar masjid sebagai background;
 * lokasi + tanggal di atas hero, kartu hitung mundur (NextPrayerCard)
 * overlay DI DALAM gambar di bagian bawah hero. Di bawahnya: jadwal lima
 * salat (PrayerSchedule), lencana sumber data, menu akses cepat (QuickMenu).
 */

import { useMemo } from "react";
import { BellOff, Info } from "lucide-react";
import { useSchedule } from "@/hooks/use-schedule";
import { useNow } from "@/hooks/use-now";
import { useAppStore } from "@/lib/store";
import { nextPrayerOf } from "@/lib/prayer/display";
import { LocationHeader } from "./LocationHeader";
import { MosqueHero } from "./MosqueHero";
import { NextPrayerCard } from "./NextPrayerCard";
import { PrayerSchedule } from "./PrayerSchedule";
import { QuickMenu } from "./QuickMenu";
import { SourceBadge } from "./SourceBadge";
import type { ViewKey } from "@/hooks/use-hash-route";

export function HomeView({
  navigate,
  onOpenLocation,
}: {
  navigate: (v: ViewKey) => void;
  onOpenLocation: () => void;
}) {
  const { schedule, tomorrow, loading, error, fromCache } = useSchedule();
  const now = useNow(1000);
  const notifications = useAppStore((s) => s.notifications);
  const next = useMemo(() => nextPrayerOf(schedule, tomorrow, now), [schedule, tomorrow, now]);
  const allOff = Object.values(notifications).every((n) => n.mode === "off");

  return (
    <div>
      {/* ===== HERO: satu section utuh — gambar masjid sebagai background ===== */}
      {/* Lokasi + tanggal di bagian ATAS hero, kartu countdown overlay di bagian BAWAH gambar */}
      <MosqueHero>
        <LocationHeader onOpenLocation={onOpenLocation} />

        {/* Jeda tampilan agar bangunan masjid terlihat jelas di belakang & di atas kartu */}
        <div className="h-16 sm:h-20 md:h-24" aria-hidden />

        {/* Kartu countdown menumpuk DI ATAS gambar masjid (bagian bawah hero) */}
        <div className="px-3 pb-3">
          {schedule ? (
            <NextPrayerCard next={next} timezone={schedule.timezone} />
          ) : loading ? (
            <SkeletonHero />
          ) : null}
        </div>
      </MosqueHero>

      {/* ===== Konten di bawah hero: jadwal salat, menu cepat, dll ===== */}
      <div className="space-y-3 px-3 pt-3">
        {!schedule ? (
          <div className="space-y-3">
            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-red-200">
                <p className="font-bold">Jadwal gagal dimuat</p>
                <p className="mt-1 leading-relaxed opacity-90">{error}</p>
                <p className="mt-2 text-xs opacity-70">
                  Periksa koneksi internet Anda, lalu buka halaman ini lagi.
                </p>
              </div>
            )}
            <SkeletonList />
          </div>
        ) : (
          <>
            {allOff && (
              <div className="flex items-start gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs text-white/75">
                <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  Semua pengingat salat sedang nonaktif. Nyalakan di{" "}
                  <button
                    onClick={() => navigate("pengaturan")}
                    className="font-bold text-gold underline"
                  >
                    Pengaturan
                  </button>{" "}
                  agar tidak terlewat.
                </span>
              </div>
            )}
            <PrayerSchedule
              schedule={schedule}
              now={now}
              nextKey={next?.tomorrow ? undefined : next?.key}
            />
            <SourceBadge schedule={schedule} fromCache={fromCache} />
            <QuickMenu navigate={navigate} />
            <p className="flex items-start gap-1.5 px-1 pb-1 text-[11px] leading-relaxed text-white/55">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Hitung mundur mengikuti zona waktu wilayah yang dipilih, bukan perangkat.
              Pengingat aktif selama aplikasi terbuka — lihat keterbatasan di Pengaturan.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SkeletonHero() {
  return (
    <div className="panel-teal-glass animate-pulse rounded-2xl p-5">
      <div className="h-3 w-24 rounded bg-white/15" />
      <div className="mt-2 h-8 w-40 rounded bg-white/20" />
      <div className="mt-4 h-9 w-44 rounded-full bg-white/20" />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="panel-teal-deep animate-pulse rounded-2xl p-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-3">
          <div className="h-6 w-6 rounded bg-white/10" />
          <div className="h-3.5 flex-1 rounded bg-white/10" />
          <div className="h-5 w-14 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}
