"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Bell, Settings, MapPin } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useHashRoute, type ViewKey } from "@/hooks/use-hash-route";
import { useNow } from "@/hooks/use-now";
import { clockInTz, longDateInTz } from "@/lib/timezone";
import { formatHijri, hijriDateInTz } from "@/lib/hijri";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
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
import { LocationSheet } from "@/components/location/LocationSheet";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationTicker } from "@/components/notifications/NotificationTicker";

export function AppShell() {
  const [view, navigate] = useHashRoute();
  const location = useAppStore((s) => s.location);
  const [locOpen, setLocOpen] = useState(false);
  const now = useNow(1000);

  const tz = location?.tz ?? "Asia/Jakarta";
  const clock = location ? clockInTz(now, tz) : "";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-az/8 via-background to-background">
      <PwaRegister />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
          <Image
            src="/icons/logo.svg"
            alt="Logo AZANUSA"
            width={36}
            height={36}
            className="rounded-xl"
            priority
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-tight tracking-wide text-teal-deep">
              AZANUSA
            </div>
            <button
              onClick={() => setLocOpen(true)}
              className="mt-0.5 flex max-w-full items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              aria-label="Ganti lokasi"
            >
              <MapPin className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">
                {location ? `${location.name}, ${location.prov}` : "Pilih lokasi wilayah"}
              </span>
            </button>
          </div>
          <span className="font-num-tabular text-xs font-semibold text-primary" aria-label="Jam wilayah">
            {clock}
          </span>
          <button
            onClick={() => navigate("pengaturan")}
            className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-primary"
            aria-label="Pengaturan"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
        <OfflineBanner />
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-3 pb-28 pt-3">
        {!location ? (
          <WelcomeCard onOpen={() => setLocOpen(true)} />
        ) : (
          <Views view={view} navigate={navigate} />
        )}
      </main>

      <BottomNav view={view} navigate={navigate} />
      <LocationSheet open={locOpen} onOpenChange={setLocOpen} />
      {location && <NotificationTicker />}

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
    case "pengaturan":
      return <SettingsView />;
    case "beranda":
    default:
      return <HomeView navigate={navigate} />;
  }
}

function WelcomeCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <Image
        src="/icons/logo.svg"
        alt="Logo AZANUSA"
        width={84}
        height={84}
        className="mx-auto rounded-2xl"
        priority
      />
      <h1 className="mt-4 text-xl font-extrabold tracking-wide text-teal-deep">AZANUSA</h1>
      <p className="mt-1 text-sm italic text-gold">Satu Indonesia, Satu Pengingat Waktu Salat.</p>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Pilih wilayah Anda untuk menampilkan jadwal salat lima waktu yang mengikuti
        zona waktu WIB, WITA, atau WIT wilayah tersebut — mencakup 38 provinsi dan
        514 kabupaten/kota di seluruh Indonesia.
      </p>
      <button
        onClick={onOpen}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        <MapPin className="h-4 w-4" />
        Pilih Wilayah
      </button>
    </div>
  );
}
