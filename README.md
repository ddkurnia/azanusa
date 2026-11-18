# AZANUSA

**Satu Indonesia, Satu Pengingat Waktu Salat.**

AZANUSA adalah aplikasi jadwal salat dan pengingat azan otomatis berbasis wilayah untuk
seluruh Indonesia: **38 provinsi, 514 kabupaten/kota**, zona waktu **WIB, WITA, WIT**.
Dibangun sebagai PWA (Progressive Web App) yang dapat dipasang di Android dan berjalan
di browser desktop/mobile.

## Fitur Utama

| Fitur | Status | Keterangan |
| --- | --- | --- |
| Dashboard beranda | ✅ | Logo, lokasi, tanggal Masehi + Hijriah, jam wilayah, hitung mundur azan berjalan |
| Jadwal salat 5 waktu | ✅ | Subuh, Zuhur, Asar, Magrib, Isya + info Imsak/Terbit; penanda waktu berikutnya |
| Pencarian wilayah | ✅ | 38 provinsi, 514 kab/kota (kode resmi Kemendagri Kepmendagri 300.2.2-2430/2025) |
| Deteksi lokasi | ✅ | Geolocation API + pencarian manual; wilayah terdekat otomatis |
| Zona waktu wilayah | ✅ | WIB (Asia/Jakarta), WITA (Asia/Makassar), WIT (Asia/Jayapura) — mengikuti wilayah, bukan perangkat |
| Sumber data modular | ✅ | Rantai penyedia: SIHAT resmi → cermin publik (opsional, dilabeli) → perhitungan astronomis terkalibrasi |
| Audio azan | ✅ | Azan lengkap CC BY-SA 4.0 + nada pengingat orisinal; volume, pratinjau, aktif per salat |
| Notifikasi | ✅ | Notification API + Service Worker; mode azan/singkat/senyap/nonaktif + pengingat sebelum waktu salat |
| Kalender Hijriah | ✅ | Standar Umm al-Qura, grid bulanan dengan tanggal Masehi |
| Kompas kiblat | ✅ | Azimut bulatan besar ke Ka'bah + kompas sensor (opsional) |
| Doa harian | ✅ | 12 doa pilihan (Arab, latin, arti) |
| Zikir | ✅ | Tasbih 33×3 + tahlil dengan counter dan getar |
| Pencarian masjid | ✅ | OpenStreetMap Overpass (radius 3 km) — butuh akses internet ke overpass-api.de |
| PWA | ✅ | Manifest, service worker, halaman offline, instalasi Android, cache jadwal offline |

## Sumber Data Jadwal (transparansi)

AZANUSA **tidak pernah mengklaim data resmi Kemenag tanpa verifikasi**. Lencana sumber
selalu tampil di beranda:

1. **SIHAT Kemenag RI (resmi, terverifikasi)** — aktif otomatis bila
   `KEMENAG_SIHAH_API_TOKEN` dikonfigurasi di server. Panduan: [`docs/KEMENAG-SIHAT.md`](docs/KEMENAG-SIHAT.md).
2. **Cermin publik (TIDAK resmi)** — replikasi data SIHAT/Bimasislam oleh pihak ketiga
   (API myQuran). Mati secara bawaan; hanya aktif bila `PRAYER_ENABLE_MIRROR=true`
   atau dipilih eksplisit oleh pengguna. Selalu dilabeli "TIDAK RESMI".
3. **Perhitungan astronomis (bawaan)** — hisab lokal kriteria Kemenag: Subuh 20°,
   Isya 18°, Asar Syafi'i; ihtiyat dikalibrasi terhadap tabel SIHAT pada 20 sampel
   (5 kota × 4 musim 2026) dengan **deviasi maksimum 4 menit, rata-rata 0,93 menit**
   (lihat `scripts/calibrate.cjs`). Data ini diberi label jelas sebagai perhitungan,
   bukan data resmi.

## Data Wilayah

- Kode & nama resmi: Kemendagri (Kepmendagri No. 300.2.2-2430 Tahun 2025).
- Koordinat: Wikidata (501 wilayah) + fallback open-admin-data (13 wilayah),
  divalidasi otomatis (jangkauan Indonesia + deteksi outlier per provinsi).
- Generator: `scripts/gen-regions.py` → `src/data/regions.json`.
- Kecamatan: belum tersedia pada versi ini (tercantum di rencana kerja lanjutan).

## Teknologi

- **Next.js 16** (App Router) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + shadcn/ui + **Lucide Icons**
- **Firebase Firestore** (cache jadwal; opsional — aplikasi tetap berfungsi penuh tanpa Firebase)
- PWA: manifest + service worker tulisan sendiri (tanpa dependensi tambahan)

## Struktur Proyek

```
src/
├── app/                  # App Router: 1 rute UI (/) + API
│   ├── api/
│   │   ├── prayer-times/ # GET jadwal salat (cache Firestore/memori + penyedia)
│   │   ├── locations/    # GET pencarian wilayah / wilayah terdekat
│   │   ├── config/       # GET status penyedia & aplikasi
│   │   └── route.ts      # health check
│   ├── layout.tsx        # metadata PWA, font (Plus Jakarta Sans + Amiri)
│   └── page.tsx
├── components/
│   ├── layout/           # AppShell, BottomNav
│   ├── dashboard/        # Hero hitung mundur, daftar salat, akses cepat, lencana sumber
│   ├── location/         # Sheet pencarian & geolokasi wilayah
│   ├── notifications/    # Ticker pengingat
│   ├── islamic/          # Kalender, kiblat, doa, zikir, masjid
│   ├── settings/         # Pengaturan (notifikasi, audio, sumber data, PWA)
│   ├── profil/           # Profil & status layanan
│   └── pwa/              # Registrasi SW, banner offline
├── lib/
│   ├── prayer/           # calculation.ts (hisab), providers.ts (rantai sumber)
│   ├── firebase/         # client, server (admin), schedule-cache (prayerSchedules)
│   ├── location/         # regions (data + pencarian + terdekat)
│   ├── audio/            # pemutar azan (unlock, volume, chime WebAudio)
│   ├── notifications/    # scheduler pengingat
│   ├── hijri.ts          # kalender Hijriah
│   ├── qibla.ts          # azimut kiblat
│   ├── timezone.ts       # util WIB/WITA/WIT
│   └── store.ts          # zustand persist (lokasi, preferensi)
├── data/
│   ├── regions.json      # 38 provinsi + 514 kab/kota (kode, koordinat, zona waktu)
│   └── islamic-content.ts
└── hooks/                # useHashRoute, useNow, useSchedule, useNotifications, useInstallPrompt
public/
├── icons/                # logo AZANUSA + ikon PWA (192/512/maskable/apple)
├── audio/                # azan.mp3 (CC BY-SA 4.0, lihat AUDIO-CREDITS.md)
├── manifest.webmanifest
├── sw.js                 # service worker (precache, network-first API, offline)
└── offline.html
```

## Struktur Database Firestore

```
prayerSchedules/{regionCode_date}   # cache jadwal per wilayah per tanggal
  ├── regionCode, regionName, date, timezone
  ├── sourceId, sourceLabel, sourceOfficial, sourceVerified, sourceNote
  ├── synchronizationTime           # ISO UTC
  └── prayerTimesUTC: { subuh, zuhur, asar, magrib, isya, [terbit, imsak] }

appConfig/{general|prayerSettings|audioSettings}   # cadangan konfigurasi (admin)
users/{userId}/{profile|preferences|notificationSettings}  # cadangan fitur akun
regions/{provinceId}/regencies/{regencyId}         # cadangan manajemen wilayah
```

Security rules: [`firestore.rules`](firestore.rules) — jadwal publik dibaca, hanya
server (Admin SDK) yang menulis; data pengguna dibatasi pemilik.

## Menjalankan Lokal

```bash
bun install          # atau npm install
cp .env.example .env.local   # isi bila ingin mengaktifkan Firebase/SIHAT (opsional)
bun run dev          # http://localhost:3000
```

Pemeriksaan kualitas:

```bash
bunx tsc --noEmit    # TypeScript ketat
bun run lint         # ESLint
bun run build        # production build
```

## Keterbatasan (jujur)

- **Pengingat & audio saat browser ditutup / perangkat tidur**: platform web tidak
  menjamin pengiriman. AZANUSA menampilkan peringatan ini di Pengaturan dan tetap
  mengirim pengingat selama aplikasi terbuka/terpasang. Untuk alarm azan yang selalu
  berbunyi, jalur pengembangan berikutnya adalah aplikasi Android native (struktur
  data & pengaturan AZANUSA sudah siap dipakai ulang).
- **Pencarian masjid** bergantung ketersediaan layanan Overpass OSM.
- **Kecamatan** belum tersedia.
- **Akun pengguna** belum aktif (butuh Firebase Authentication — struktur siap).

## Lisensi & Atribusi

- Kode: lihat `LICENSE`.
- Audio azan: CC BY-SA 4.0 — atribusi di `public/audio/AUDIO-CREDITS.md`.
- Data wilayah: Kemendagri (publik), Wikidata (CC0), OpenStreetMap contributors (ODbL).
