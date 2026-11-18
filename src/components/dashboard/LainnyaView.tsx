"use client";

/**
 * LainnyaView — halaman "Lainnya" dari menu akses cepat:
 * Zikir, Pengaturan, instalasi PWA, dan tentang aplikasi (logo resmi di
 * kartu putih sehingga logo asli tampil utuh apa adanya).
 */

import Image from "next/image";
import { CircleDot, Download, Settings, Smartphone } from "lucide-react";
import type { ViewKey } from "@/hooks/use-hash-route";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function LainnyaView({ navigate }: { navigate: (v: ViewKey) => void }) {
  const { available, installed, promptInstall } = useInstallPrompt();

  return (
    <div className="space-y-3 text-white">
      <section className="panel-teal rounded-2xl p-4 shadow-md shadow-black/20">
        <h2 className="text-base font-extrabold">Lainnya</h2>
        <p className="mt-0.5 text-[11px] text-white/65">
          Fitur pendukung ibadah harian dan pengaturan aplikasi.
        </p>
      </section>

      <section className="panel-teal-deep overflow-hidden rounded-2xl shadow-md shadow-black/20">
        <ul className="divide-y divide-white/10">
          <li>
            <button
              onClick={() => navigate("zikir")}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
            >
              <CircleDot className="h-5 w-5 shrink-0 text-gold" />
              <span className="flex-1 text-sm font-bold">Zikir &amp; Tasbih</span>
              <span className="text-[11px] text-white/55">Counter 33×3</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate("pengaturan")}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
            >
              <Settings className="h-5 w-5 shrink-0 text-gold" />
              <span className="flex-1 text-sm font-bold">Pengaturan</span>
              <span className="text-[11px] text-white/55">Notifikasi, audio, sumber data</span>
            </button>
          </li>
          <li>
            <button
              onClick={async () => {
                const res = await promptInstall();
                if (res === "unavailable") {
                  window.alert(
                    "Instalasi tidak tersedia di peramban ini. Gunakan Chrome Android (menu \u22ee \u2192 Instal aplikasi) atau fitur Tambahkan ke Layar Utama."
                  );
                }
              }}
              disabled={installed}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 disabled:opacity-50"
            >
              {installed ? (
                <Smartphone className="h-5 w-5 shrink-0 text-gold" />
              ) : (
                <Download className="h-5 w-5 shrink-0 text-gold" />
              )}
              <span className="flex-1 text-sm font-bold">
                {installed ? "Aplikasi terpasang" : "Instal Aplikasi (PWA)"}
              </span>
              <span className="text-[11px] text-white/55">
                {available && !installed ? "Tersedia" : installed ? "Aktif" : "Via menu peramban"}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 text-center shadow-md shadow-black/20">
        <Image
          src="/assets/azanusa-logo.png"
          alt="Logo resmi AZANUSA"
          width={2172}
          height={724}
          className="mx-auto h-auto w-full max-w-[280px]"
        />
        <p className="mt-3 text-sm font-bold text-[#003d38]">Satu Indonesia, Satu Pengingat Waktu Salat.</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          AZANUSA v1.1.0 — PWA jadwal salat untuk 38 provinsi dan 514 kabupaten/kota,
          zona WIB/WITA/WIT. Jadwal tampil dengan lencana sumber yang jujur; kode wilayah
          resmi Kemendagri. Keterbatasan platform web dijelaskan di Pengaturan.
        </p>
      </section>
    </div>
  );
}
