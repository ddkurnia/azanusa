"use client";

import { useState } from "react";
import {
  BellRing, BellOff, Volume2, Database, Download, Info,
  ShieldAlert, Smartphone, CheckCircle2, AlertTriangle, CloudUpload,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { azanPlayer } from "@/lib/audio/azan";
import {
  enablePushNotifications,
  disablePushNotifications,
  isPushConfigured,
  sendTestPush,
} from "@/lib/notifications/push";
import { PRAYER_KEYS, PRAYER_NAMES } from "@/types";
import type { NotifyMode } from "@/types";
import { EmptyState } from "@/components/islamic/CalendarView";

const MODE_OPTIONS: { value: NotifyMode; label: string }[] = [
  { value: "azan", label: "Azan lengkap" },
  { value: "short", label: "Pengingat singkat" },
  { value: "silent", label: "Tanpa suara" },
  { value: "off", label: "Nonaktif" },
];

export function SettingsView() {
  const {
    location, dataSource, notifications, volume, audioUnlocked, pushEnabled,
    setDataSource, setNotification, setAllNotifications, setVolume, setAudioUnlocked, setPushEnabled,
  } = useAppStore();
  const { permission, requestPermission } = useNotifications();
  const { available, installed, promptInstall } = useInstallPrompt();
  const [unlocking, setUnlocking] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const pushConfigured = isPushConfigured();

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

  async function handlePushToggle(v: boolean) {
    if (!location) return;
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (v) {
        const res = await enablePushNotifications(location, notifications);
        if (res.state === "ok") {
          setPushEnabled(true);
          setPushMsg({ tone: "ok", text: "Push aktif — perangkat terdaftar di cloud AZANUSA." });
        } else {
          setPushEnabled(false);
          setPushMsg({ tone: "err", text: res.detail });
        }
      } else {
        await disablePushNotifications();
        setPushEnabled(false);
        setPushMsg({ tone: "ok", text: "Push dimatikan. Pengingat tetap berbunyi selama aplikasi terbuka." });
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestNotification() {
    if (!("Notification" in window)) return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      const title = "Notifikasi uji AZANUSA";
      const body = location
        ? `Contoh pengingat untuk ${location.name}, ${location.prov}.`
        : "Contoh pengingat AZANUSA.";
      if (reg) {
        await reg.showNotification(title, {
          body,
          tag: "azanusa-test",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          lang: "id",
        });
      } else {
        const n = new Notification(title, { body });
        n.onclick = () => window.focus();
      }
    } catch {
      // izin dicabut — abaikan
    }
  }

  /** Uji jalur push cloud PENUH (server → FCM → service worker → notifikasi). */
  async function handleTestPush() {
    setPushBusy(true);
    setPushMsg(null);
    const res = await sendTestPush();
    setPushMsg(
      res.ok
        ? { tone: "ok", text: res.detail }
        : { tone: "err", text: res.detail || "Gagal mengirim push uji." }
    );
    setPushBusy(false);
  }

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

        {/* Push via Firebase Cloud Messaging */}
        <div className="mt-4 rounded-xl border border-primary/30 bg-emerald-soft p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold text-teal-deep">Push notifikasi</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Pengingat tetap terkirim walau aplikasi sudah ditutup
                </p>
              </div>
            </div>
            <Switch
              checked={pushEnabled}
              onCheckedChange={handlePushToggle}
              disabled={pushBusy || !notifSupported}
              aria-label="Aktifkan push notifikasi"
            />
          </div>
          {!pushConfigured && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
              Layanan push belum aktif — coba beberapa saat lagi.
            </p>
          )}
          {pushMsg && (
            <p
              className={`mt-2 text-[11px] leading-relaxed ${
                pushMsg.tone === "ok" ? "text-primary" : "text-amber-800"
              }`}
            >
              {pushMsg.text}
            </p>
          )}
          {permission === "granted" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleTestNotification}
                className="rounded-lg border border-primary/40 px-3.5 py-2 text-xs font-bold text-primary"
              >
                Kirim notifikasi uji
              </button>
              {pushEnabled && pushConfigured && (
                <button
                  onClick={handleTestPush}
                  disabled={pushBusy}
                  className="rounded-lg border border-primary/40 px-3.5 py-2 text-xs font-bold text-primary disabled:opacity-60"
                >
                  {pushBusy ? "Mengirim…" : "Kirim push uji (cloud)"}
                </button>
              )}
            </div>
          )}
        </div>

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
            <strong>Cara kerja azan:</strong> saat aplikasi terbuka, azan Makkah diputar
            otomatis langsung dari perangkat sesuai mode per salat. Saat aplikasi
            ditutup, push cloud AZANUSA menampilkan notifikasi sistem tepat waktu
            (berbunyi nada notifikasi perangkat) — <strong>ketuk notifikasinya maka
            AZANUSA terbuka dan memutar azan penuh secara otomatis</strong>. Peramban
            memang tidak mengizinkan web memutar audio di latar tanpa sentuhan;
            agar bunyi azan terdengar sebelum dibuka, atur nada notifikasi ponsel
            ke audio azan dan matikan optimasi baterai untuk peramban Anda.
          </span>
        </p>
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            <strong>Pengirim push:</strong> berjalan otomatis lewat beacon antar
            perangkat AZANUSA (setiap aplikasi yang terbuka memicu pengiriman ke
            semua perangkat). Uji jalurnya dengan tombol <strong>Kirim push uji
            (cloud)</strong> di atas. Supaya azan tetap terkirim saat <em>semua</em>
            aplikasi tertutup, cron pengirim wajib aktif — satu langkah di
            docs/push-dispatch.yml pada repo GitHub (butuh akses pemilik repo).
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
          Azan Makkah: &quot;Adhan, Great Mosque of Mecca — Jan 21, 2013&quot; oleh
          Seyfula Islam, Wikimedia Commons, CC BY 3.0 (dengan atribusi). Detail di
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
            { v: "auto", t: "Otomatis (paling akurat tersedia)", d: "Otomatis memilih sumber jadwal paling akurat yang tersedia" },
            { v: "kemenag", t: "SIHAT Kemenag (resmi)", d: "Jadwal resmi langsung dari API SIHAT Kemenag RI" },
            { v: "mirror", t: "Cermin publik (TIDAK RESMI)", d: "Jadwal Kemenag melalui layanan cermin publik" },
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
      </p>
    </div>
  );
}
