"use client";

import { useEffect, useState } from "react";
import {
  BellRing, BellOff, Volume2, Database, Download, Info,
  ShieldAlert, Smartphone, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { azanPlayer } from "@/lib/audio/azan";
import { PRAYER_KEYS, PRAYER_NAMES } from "@/types";
import type { NotifyMode, ProviderStatus } from "@/types";
import { EmptyState } from "@/components/islamic/CalendarView";

const MODE_OPTIONS: { value: NotifyMode; label: string }[] = [
  { value: "azan", label: "Azan lengkap" },
  { value: "short", label: "Pengingat singkat" },
  { value: "silent", label: "Tanpa suara" },
  { value: "off", label: "Nonaktif" },
];

export function SettingsView() {
  const {
    location, dataSource, notifications, volume, audioUnlocked,
    setDataSource, setNotification, setAllNotifications, setVolume, setAudioUnlocked,
  } = useAppStore();
  const { permission, requestPermission } = useNotifications();
  const { available, installed, promptInstall } = useInstallPrompt();
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((j) => j.ok && setProviders(j.providers))
      .catch(() => setProviders(null));
  }, []);

  if (!location) {
    return (
      <EmptyState
        icon={Database}
        title="Pengaturan"
        text="Pilih wilayah terlebih dahulu. Pengaturan notifikasi, audio, dan sumber data dapat diatur setelahnya."
      />
    );
  }

  const notifSupported = permission !== "unsupported";

  return (
    <div className="space-y-4">
      {/* Notifikasi */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <header className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-teal-deep">Pengingat Salat</h2>
        </header>

        {!notifSupported && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Peramban ini tidak mendukung Notification API. Pengingat tidak tersedia; gunakan Chrome/Edge terbaru di Android atau desktop.
          </p>
        )}
        {notifSupported && permission !== "granted" && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-emerald-soft p-3">
            <p className="text-xs leading-relaxed text-secondary-foreground">
              {permission === "denied"
                ? "Izin notifikasi DITOLAK. Buka pengaturan situs di peramban untuk mengizinkan ulang AZANUSA."
                : "Izinkan notifikasi agar AZANUSA dapat mengingatkan waktu salat saat aplikasi terbuka."}
            </p>
            {permission !== "denied" && (
              <button
                onClick={requestPermission}
                className="mt-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
              >
                Izinkan notifikasi
              </button>
            )}
          </div>
        )}
        {permission === "granted" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-soft px-3 py-2 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Izin notifikasi aktif
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <span className="text-sm font-semibold">Nyalakan semua</span>
            <Switch
              checked={PRAYER_KEYS.every((k) => notifications[k].mode !== "off")}
              onCheckedChange={(v) => setAllNotifications(v ? "azan" : "off")}
              aria-label="Aktifkan semua pengingat"
            />
          </div>
          {PRAYER_KEYS.map((key) => (
            <div key={key} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-teal-deep">{PRAYER_NAMES[key]}</span>
                <select
                  value={notifications[key].mode}
                  onChange={(e) => setNotification(key, { mode: e.target.value as NotifyMode })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold"
                  aria-label={`Mode pengingat salat ${PRAYER_NAMES[key]}`}
                >
                  {MODE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {notifications[key].mode !== "off" && (
                <label className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>
                    Pengingat sebelum waktu salat ({notifications[key].beforeMinutes > 0 ? `${notifications[key].beforeMinutes} menit` : "nonaktif"})
                  </span>
                  <select
                    value={notifications[key].beforeMinutes}
                    onChange={(e) => setNotification(key, { beforeMinutes: Number(e.target.value) })}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold"
                    aria-label={`Pengingat sebelum salat ${PRAYER_NAMES[key]}`}
                  >
                    <option value={0}>Tidak perlu</option>
                    <option value={5}>5 menit</option>
                    <option value={10}>10 menit</option>
                    <option value={15}>15 menit</option>
                    <option value={30}>30 menit</option>
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            <strong>Batasan platform (penting):</strong> peramban Android tidak menjamin
            notifikasi terkirim saat browser ditutup atau perangkat tidur lama. Pengingat
            paling andal saat aplikasi terbuka/terpasang dan tab aktif. Untuk azan yang
            selalu berbunyi di seluruh kondisi perangkat, diperlukan aplikasi Android
            native (dikonfigurasi pada pengembangan lanjutan AZANUSA).
          </span>
        </p>
      </section>

      {/* Audio */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <header className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-teal-deep">Audio Azan</h2>
        </header>
        {audioUnlocked ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-soft px-3 py-2 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Audio siap diputar saat aplikasi terbuka
          </p>
        ) : (
          <div className="mt-3 rounded-xl border border-primary/30 bg-emerald-soft p-3">
            <p className="text-xs leading-relaxed text-secondary-foreground">
              Kebijakan peramban meminta satu ketukan untuk mengaktifkan audio azan.
            </p>
            <button
              onClick={async () => {
                setUnlocking(true);
                azanPlayer.setVolume(volume);
                const ok = await azanPlayer.unlock();
                setAudioUnlocked(ok);
                setUnlocking(false);
              }}
              disabled={unlocking}
              className="mt-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              {unlocking ? "Mengaktifkan…" : "Aktifkan audio azan"}
            </button>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[Math.round(volume * 100)]}
            onValueChange={(v) => {
              setVolume(v[0] / 100);
              azanPlayer.setVolume(v[0] / 100);
            }}
            max={100}
            step={5}
            aria-label="Volume azan"
          />
          <span className="font-num-tabular w-10 text-right text-xs font-bold">{Math.round(volume * 100)}%</span>
        </div>
        <button
          onClick={() => {
            azanPlayer.setVolume(volume);
            if (audioUnlocked) azanPlayer.playAzan();
            else azanPlayer.playChime();
          }}
          className="mt-3 rounded-xl border border-primary/40 px-4 py-2 text-xs font-bold text-primary"
        >
          Pratinjau {audioUnlocked ? "azan" : "nada pengingat"}
        </button>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Azan: &quot;The Adhan — Muslim Call to Prayer — Aaqib Azeez&quot; oleh Atcovi,
          Wikimedia Commons, CC BY-SA 4.0 (dengan atribusi). Detail di
          public/audio/AUDIO-CREDITS.md.
        </p>
      </section>

      {/* Sumber data */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <header className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-teal-deep">Sumber Data Jadwal</h2>
        </header>
        <div className="mt-3 space-y-2">
          {[
            { v: "auto", t: "Otomatis (paling akurat tersedia)", d: "SIHAT resmi bila dikonfigurasi → perhitungan astronomis" },
            { v: "kemenag", t: "SIHAT Kemenag (resmi)", d: providers?.kemenagSihatConfigured ? "Token tersedia" : "Menunggu konfigurasi token — status: tidak aktif" },
            { v: "mirror", t: "Cermin publik (TIDAK RESMI)", d: providers?.mirrorEnabled ? "Diaktifkan lewat server" : "Membutuhkan pengaktifan di server (PRAYER_ENABLE_MIRROR)" },
            { v: "calc", t: "Perhitungan astronomis", d: "Kriteria Kemenag, dikalibrasi (deviasi 0-4 menit)" },
          ].map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                dataSource === o.v ? "border-primary/50 bg-emerald-soft" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="sumber"
                checked={dataSource === o.v}
                onChange={() => setDataSource(o.v as typeof dataSource)}
                className="mt-1 accent-[#0e7a55]"
              />
              <span>
                <span className="block text-sm font-bold text-teal-deep">{o.t}</span>
                <span className="block text-[11px] text-muted-foreground">{o.d}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Data jadwal yang ditampilkan selalu mencantumkan sumber aktif pada lencana di
          beranda. AZANUSA tidak mengklaim jadwal sebagai &quot;resmi Kemenag&quot; kecuali
          benar-benar diambil dari API SIHAT yang telah dikonfigurasi.
        </p>
      </section>

      {/* PWA */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <header className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-teal-deep">Aplikasi (PWA)</h2>
        </header>
        {installed ? (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            AZANUSA terpasang di perangkat ini.
          </p>
        ) : available ? (
          <button
            onClick={promptInstall}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Download className="h-4 w-4" />
            Pasang AZANUSA di perangkat
          </button>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Untuk memasang: buka menu peramban (⋮) lalu pilih &quot;Instal aplikasi&quot; /
            &quot;Tambahkan ke layar utama&quot;. Setelah terpasang, AZANUSA berjalan layaknya
            aplikasi Android dan tersedia offline untuk jadwal terakhir.
          </p>
        )}
      </section>

      <p className="flex items-start gap-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Pengaturan disimpan di perangkat (localStorage) dan tidak memerlukan akun.
        Sinkronisasi akun tersedia bila Firebase Authentication diaktifkan pada tahap
        pengembangan berikutnya.
      </p>
    </div>
  );
}
