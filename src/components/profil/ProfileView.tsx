"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin, Database, Server, Github, ExternalLink, Download, Clock } from "lucide-react";
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

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold text-teal-deep">Status Layanan</h2>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Server className="h-4 w-4" />API SIHAT Kemenag</span>
            <span className={`font-semibold ${config?.providers.kemenagSihatConfigured ? "text-primary" : "text-muted-foreground"}`}>
              {config?.providers.kemenagSihatConfigured ? "Aktif" : "Menunggu konfigurasi"}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Server className="h-4 w-4" />Firebase</span>
            <span className={`font-semibold ${config?.providers.firebaseConfigured ? "text-primary" : "text-muted-foreground"}`}>
              {config?.providers.firebaseConfigured ? "Terhubung" : "Belum dikonfigurasi"}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Server className="h-4 w-4" />PWA</span>
            <span className={`font-semibold ${installed ? "text-primary" : "text-muted-foreground"}`}>
              {installed ? "Terpasang" : "Peramban"}
            </span>
          </li>
        </ul>
        {!installed && available && (
          <button
            onClick={promptInstall}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Download className="h-4 w-4" />
            Pasang aplikasi
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold text-teal-deep">Tentang &amp; Sumber Data</h2>
        <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <li>
            <a className="flex items-center gap-1.5 font-semibold text-primary" href="https://sihat.kemenag.go.id/layanan" target="_blank" rel="noopener noreferrer">
              SIHAT — Sistem Informasi Jadwal Salat Kemenag RI <ExternalLink className="h-3 w-3" />
            </a>
            <span className="block pl-5">
              Prioritas utama AZANUSA. Akses API memerlukan permohonan resmi; panduan
              konfigurasi tersedia di dokumentasi proyek.
            </span>
          </li>
          <li>
            <span className="block">
              Perhitungan astronomis: kriteria hisab Kemenag (Subuh 20°, Isya 18°, Asar
              Syafi&apos;i) dikalibrasi terhadap tabel SIHAT — deviasi umum 0–4 menit.
            </span>
          </li>
          <li>
            <span className="block">
              Data wilayah: Kemendagri (Kepmendagri 300.2.2-2430/2025) + koordinat
              Wikidata/OpenStreetMap. Audio azan: CC BY-SA 4.0 (atribusi di halaman Pengaturan).
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <Github className="h-3 w-3" />
            Kode sumber AZANUSA: repositori GitHub
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">azanusa</code>
          </li>
        </ul>
      </section>

      <p className="px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
        AZANUSA dibangun sebagai produk digital untuk seluruh masyarakat Indonesia.
        Pengaturan tersimpan lokal di perangkat.
      </p>
    </div>
  );
}
