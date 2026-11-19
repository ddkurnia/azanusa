# Panduan Deployment AZANUSA ke Vercel

Aplikasi ini kompatibel dengan Vercel (Next.js App Router, tanpa server permanen).

## 1. Siapkan Akun & Repository

1. Buat/ masuk akun di <https://vercel.com> (paket Hobby gratis memadai untuk memulai —
   perhatikan batas kuota: eksekusi serverless, bandwidth, dan jumlah deployment/hari).
2. Hubungkan akun GitHub Anda: **Settings → Git Integrations → GitHub**.

## 2. Import Repository

1. Dashboard Vercel → **Add New → Project**.
2. Pilih repository `azanusa`.
3. Framework Preset terdeteksi otomatis: **Next.js** (biarkan default build:
   `next build`, output `standalone` didukung Vercel).
4. Tekan **Deploy** (boleh tanpa environment variables untuk mencoba versi perhitungan
   astronomis — aplikasi tetap berfungsi penuh).

## 3. Environment Variables

**Settings → Environment Variables** — salin dari `.env.example`:

| Variabel | Wajib? | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Opsional | Aktifkan Firestore client (cache cloud) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Opsional | Admin SDK untuk cache Firestore (server) |
| `KEMENAG_SIHAH_API_TOKEN` | Opsional | Aktifkan data resmi SIHAT (lihat docs/KEMENAG-SIHAT.md) |
| `KEMENAG_SIHAH_API_BASE_URL` | Opsional | Default `https://sihat.kemenag.go.id` |
| `KEMENAG_SIHAH_WILAYAH_MAP` | Opsional | JSON pemetaan kode wilayah → kode SIHAT |
| `PRAYER_ENABLE_MIRROR` | Opsional | Bawaan aktif (jadwal Kemenag via cermin myQuran + Aladhan KEMENAG); isi `false` untuk hanya SIHAT resmi + hisab lokal |

> Catatan: variabel kredensial hanya boleh di dashboard Vercel — **tidak pernah** di
> source code atau repository.

## 4. Deployment Otomatis

Setiap push ke `main` otomatis memicu build baru. Pantau tab **Deployments**.

## 5. Domain Khusus (opsional)

1. **Settings → Domains → Add** → masukkan domain Anda.
2. Ikuti instruksi DNS (A record 76.76.21.21 atau CNAME cname.vercel-dns.com).
3. Sertifikat TLS diterbitkan otomatis.

## 6. Pemeriksaan Setelah Deploy

```bash
curl "https://<domain-anda>/api/config"              # status penyedia
curl "https://<domain-anda>/api/prayer-times?code=3171"
```

- Lencana sumber di beranda harus menampilkan sumber aktif + waktu sinkronisasi.
- Uji PWA: buka domain di Chrome Android → menu ⋮ → **Instal aplikasi**.
- Uji offline: matikan internet, buka ulang → jadwal terakhir dari cache.

## 7. Firebase (opsional)

1. Buat proyek di <https://console.firebase.google.com> (Spark gratis).
2. Aktifkan **Firestore** (mode produksi) → deploy rules: `firebase deploy --only firestore:rules`.
3. Salin konfigurasi web ke `NEXT_PUBLIC_FIREBASE_*`.
4. Buat **service account** (Project settings → Service accounts) → salin
   `client_email` dan `private_key` ke `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`
   (ganti newline menjadi `\n`).
5. Pada paket Spark: kuota gratis cukup untuk cache jadwal (baca/tulis harian rendah
   karena cache per wilayah per tanggal).

## 8. Batas Paket Gratis

- **Vercel Hobby**: 100 GB bandwidth/bulan, serverless 100 GB-jam, 6000 menit build.
- **Firebase Spark**: Firestore 1 GB penyimpanan, 50k baca & 20k tulis/hari.
- **SIHAT Kemenag**: batas permintaan ditentukan Kemenag per token.

Sesuaikan taksiran permintaan saat pengajuan SIHAT (1 permintaan per wilayah per
tanggal dapat melayani banyak pengguna karena hasil di-cache Firestore).
