"use client";

/**
 * AppShell — kerangka aplikasi AZANUSA sesuai mockup resmi:
 * header teal gelap (AppHeader), dashboard gelap (beranda), navigasi bawah
 * putih lima menu (BottomNavigation), splash pembuka sekali per perangkat.
 */

import { useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useHashRoute, type ViewKey } from "@/hooks/use-hash-route";
import { longDateInTz } from "@/lib/timezone";
import { formatHijri, hijriDateInTz } from "@/lib/hijri";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { HomeView } from "@/components/dashboard/HomeView";
import { ScheduleView } from "@/components/dashboard/ScheduleView";
import { SettingsView } from "@/components/settings/SettingsView";
import { ProfileView } from "@/components/profil/ProfileView";
import { CalendarView } from "@/components/islamic/CalendarView";
import { QiblaView } from "@/components/islamic/QiblaView";
import { DuaView } from "@/components/islamic/DuaView";
import { ZikirView } from "@/components/islamic/ZikirView";
import { MosqueView } from "@/components/islamic/MosqueView";
import { QuranView } from "@/components/islamic/QuranView";
import { LainnyaView } from "@/components/dashboard/LainnyaView";
import { LocationSheet } from "@/components/location/LocationSheet";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { SplashGate } from "@/components/layout/SplashGate";
import { NotificationTicker } from "@/components/notifications/NotificationTicker";
import { PushForeground } from "@/components/notifications/PushForeground";

export function AppShell() {
  const [view, navigate] = useHashRoute();
  const location = useAppStore((s) => s.location);
  const [locOpen, setLocOpen] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const tz = location?.tz ?? "Asia/Jakarta";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#01423b] via-[#033832] to-[#012e29]">
      <SplashGate
        onFinish={() => {
          setSplashDone(true);
          // Buka pemilih wilayah bila lokasi belum dipilih (konteks klik pengguna)
          if (!useAppStore.getState().location) setLocOpen(true);
        }}
      />
      <PwaRegister />
      <AppHeader navigate={navigate} />

      <main className="mx-auto w-full max-w-xl flex-1 pb-24">
        {!location ? (
          <WelcomeDark onOpen={() => setLocOpen(true)} />
        ) : view === "beranda" ? (
          <HomeView navigate={navigate} onOpenLocation={() => setLocOpen(true)} />
        ) : (
          <div className="px-3 pt-3">
            <Views view={view} navigate={navigate} />
          </div>
        )}
      </main>

      <BottomNavigation view={view} navigate={navigate} />
      <LocationSheet open={locOpen} onOpenChange={setLocOpen} />
      {location && <NotificationTicker />}
      <PushForeground />

      {location ? (
        <div className="sr-only" aria-live="polite">
          {longDateInTz(new Date(), tz)} — {formatHijri(hijriDateInTz(new Date(), tz))}
        </div>
      ) : null}
    </div>
  );
}

function Views({ view, navigate }: { view: ViewKey; navigate: (v: ViewKey) => void }) {
  switch (view) {
    case "jadwal":
      return <ScheduleView />;
    case "alquran":
      return <QuranView />;
    case "kalender":
      return <CalendarView />;
    case "kiblat":
      return <QiblaView />;
    case "doa":
      return <DuaView />;
    case "zikir":
      return <ZikirView />;
    case "masjid":
      return <MosqueView />;
    case "profil":
      return <ProfileView />;
    case "lainnya":
      return <LainnyaView navigate={navigate} />;
    case "pengaturan":
      return <SettingsView />;
    case "beranda":
    default:
      return null;
  }
}

function WelcomeDark({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="px-3 pt-6">
      <div className="panel-teal rounded-2xl p-6 text-center shadow-lg shadow-black/25">
        <Image
          src="/assets/azanusa-logo-mark.png"
          alt="Logo AZANUSA"
          width={472}
          height={491}
          className="mx-auto h-16 w-auto"
          priority
        />
        <h1 className="mt-3 text-xl font-extrabold tracking-wide text-white">
          AZAN<span className="text-gold">USA</span>
        </h1>
        <p className="mt-1 text-sm font-medium italic text-gold">
          Satu Indonesia, Satu Pengingat Waktu Salat.
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/75">
          Pilih wilayah Anda untuk menampilkan jadwal salat lima waktu yang mengikuti
          zona waktu WIB, WITA, atau WIT wilayah tersebut — mencakup 38 provinsi dan
          514 kabupaten/kota di seluruh Indonesia.
        </p>
        <button
          onClick={onOpen}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ffd95c] to-[#f5c542] px-6 py-3 text-sm font-extrabold text-[#01322d] shadow-lg transition hover:brightness-105"
        >
          <MapPin className="h-4 w-4" />
          Pilih Wilayah
        </button>
      </div>
    </div>
  );
}
