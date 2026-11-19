"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin, Database, Download, Clock } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useSchedule } from "@/hooks/use-schedule";
import { timeZoneLabel } from "@/lib/timezone";
import type { ApiConfigResponse } from "@/types";

export function ProfileView() {
  const location = useAppStore((s) => s.location);
  const dataSource = useAppStore((s) => s.dataSource);
  const { schedule, fromCache } = useSchedule();
  const { available, installed, promptInstall } = useInstallPrompt();
  const [config, setConfig] = useState<ApiConfigResponse | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((j) => j.ok && setConfig(j as ApiConfigResponse))
      .catch(() => setConfig(null));
  }, []);

  return (
    <div className="space-y-3">
      <section className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-deep via-teal-mid to-emerald-az p-6 text-center text-white shadow-md">
        <div className="pattern-islamic pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative">
          <Image
            src="/icons/logo.svg"
            alt="Logo AZANUSA"
            width={72}
            height={72}
            className="mx-auto rounded-2xl border-2 border-gold/60"
            priority
          />
          <h1 className="mt-3 text-2xl font-extrabold tracking-wide">AZANUSA</h1>
          <p className="mt-1 text-sm italic text-gold-soft">Satu Indonesia, Satu Pengingat Waktu Salat.</p>
          <p className="mt-1 text-[11px] text-white/60">Versi aplikasi: {config?.appVersion ?? "1.0.0"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold text-teal-deep">Lokasi &amp; Preferensi</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" />Wilayah</dt>
            <dd className="font-semibold text-right">{location ? `${location.name}, ${location.prov}` : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" />Zona waktu</dt>
            <dd className="font-semibold">{location ? `${timeZoneLabel(location.tz)} (${location.tz})` : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><Database className="h-4 w-4" />Sumber data</dt>
            <dd className="font-semibold">
              {schedule?.source.label ?? dataSource}
              {fromCache ? " (cache)" : ""}
            </dd>
          </div>
        </dl>
      </section>

      {!installed && available && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <button
            onClick={promptInstall}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Download className="h-4 w-4" />
            Pasang aplikasi
          </button>
        </section>
      )}

      <p className="px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
        AZANUSA dibangun sebagai produk digital untuk seluruh masyarakat Indonesia.
        Pengaturan tersimpan lokal di perangkat.
      </p>
    </div>
  );
}
