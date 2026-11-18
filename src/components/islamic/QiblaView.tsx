"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compass, Smartphone, Navigation } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { qiblaBearing, distanceToKaabaKm, compassDirection, KAABA_LAT, KAABA_LNG } from "@/lib/qibla";
import { EmptyState } from "./CalendarView";

interface OrientationEventWithAlpha extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export function QiblaView() {
  const location = useAppStore((s) => s.location);
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const lastHeadingRef = useRef(0);

  const bearing = useMemo(
    () => (location ? qiblaBearing(location.lat, location.lng) : 0),
    [location]
  );
  const distance = useMemo(
    () => (location ? distanceToKaabaKm(location.lat, location.lng) : 0),
    [location]
  );

  const startCompass = useCallback(async () => {
    setError("");
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setError("Perangkat/peramban tidak mendukung sensor kompas. Gunakan angka derajat dengan kompas fisik atau aplikasi peta.");
      return;
    }
    try {
      const DOE = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DOE?.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") {
          setError("Izin sensor kompas ditolak.");
          return;
        }
      }
      setActive(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const onOrient = (ev: Event) => {
      const e = ev as OrientationEventWithAlpha;
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
        h = e.webkitCompassHeading;
      } else if (typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
        h = 360 - (e.alpha % 360);
      }
      if (h !== null && Math.abs(h - lastHeadingRef.current) > 1) {
        lastHeadingRef.current = h;
        setHeading(h);
      }
    };
    window.addEventListener("deviceorientationabsolute" as keyof WindowEventMap, onOrient as EventListener, true);
    window.addEventListener("deviceorientation", onOrient as EventListener, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute" as keyof WindowEventMap, onOrient as EventListener, true);
      window.removeEventListener("deviceorientation", onOrient as EventListener, true);
    };
  }, [active]);

  if (!location) {
    return (
      <EmptyState
        icon={Compass}
        title="Arah Kiblat"
        text="Pilih wilayah terlebih dahulu untuk menghitung arah kiblat dari koordinat wilayah Anda."
      />
    );
  }

  const rotation = heading !== null ? bearing - heading : bearing;
  const aligned = heading !== null && Math.abs(((rotation % 360) + 360) % 360) < 4;

  return (
    <div className="space-y-3">
      <section className="animate-fade-up rounded-2xl bg-gradient-to-br from-teal-deep to-emerald-az p-5 text-white shadow-md">
        <p className="text-[11px] text-white/70">Arah kiblat dari {location.name}</p>
        <p className="mt-1 text-3xl font-extrabold">
          {bearing.toFixed(1)}° <span className="text-base font-semibold text-gold-soft">{compassDirection(bearing)}</span>
        </p>
        <p className="mt-1 text-xs text-white/70">
          dari utara sejati · {distance.toLocaleString("id-ID")} km ke Ka'bah
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="relative mx-auto h-64 w-64">
          <div className="absolute inset-0 rounded-full border-4 border-border bg-gradient-to-b from-secondary to-card" />
          {["U", "T", "S", "B"].map((d, i) => (
            <span
              key={d}
              className="absolute text-xs font-bold text-muted-foreground"
              style={{
                top: i === 0 ? 8 : i === 2 ? undefined : "50%",
                bottom: i === 2 ? 8 : undefined,
                left: i === 3 ? 10 : i === 1 ? undefined : "50%",
                right: i === 1 ? 10 : undefined,
                transform: i === 0 || i === 2 ? "translateX(-50%)" : i === 1 || i === 3 ? "translateY(-50%)" : undefined,
              }}
            >
              {d}
            </span>
          ))}
          <div
            className="absolute inset-3 transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div
              className={`absolute left-1/2 top-4 h-24 w-1.5 -translate-x-1/2 rounded-full ${
                aligned ? "bg-gold" : "bg-primary"
              }`}
              style={{ transformOrigin: "50% calc(96px + 1rem)" }}
            >
              <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm bg-inherit" />
            </div>
            <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[10px] font-black text-gold">
              KIBLAT
            </span>
          </div>
          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card bg-teal-deep shadow">
            <span className="text-[9px] font-black text-gold-soft">KA'BAH</span>
          </div>
        </div>

        {!active && (
          <div className="mt-4">
            <button
              onClick={startCompass}
              className="mx-auto flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow"
            >
              <Smartphone className="h-4 w-4" />
              Aktifkan kompas perangkat
            </button>
          </div>
        )}
        {active && (
          <p className={`mt-4 text-center text-sm font-semibold ${aligned ? "text-primary" : "text-muted-foreground"}`}>
            {heading === null
              ? "Menunggu data sensor…"
              : aligned
                ? "Ketuk: perangkat menghadap kiblat"
                : `Arahkan perangkat hingga panah segaris dengan tanda KIBLAT (butuh ${bearing.toFixed(0)}° dari utara)`}
          </p>
        )}
        {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}

        <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Perhitungan memakai azimut bulatan besar dari koordinat wilayah ke Ka'bah
          (21.4225°, 39.8262°). Tanpa sensor kompas, gunakan angka derajat dengan
          kompas fisik atau aplikasi peta. Akurasi di ponsel tergantung kalibrasi
          sensor (gerakkan perangkat berbentuk angka 8 bila arah tampak melenceng).
        </p>
      </section>
    </div>
  );
}
