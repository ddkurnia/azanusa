# Notifikasi AZANUSA — Arsitektur & Setup

Dokumen ini menjelaskan sistem pengingat salat AZANUSA secara utuh: dua jalur
pengiriman (lokal + push Firebase), struktur data Firestore, dan langkah
konfigurasi di project Firebase `azanusa`.

## Dua jalur pengingat

| Jalur | Aktif kapan | Mekanisme | Berkas |
| --- | --- | --- | --- |
| **Lokal** | Selama aplikasi terbuka (tab aktif/latar) | Timer di UI memeriksa jadwal tiap ~15 detik, menampilkan notifikasi via Service Worker, memutar azan Makkah sesuai mode per salat | `src/lib/notifications/scheduler.ts`, `src/components/notifications/NotificationTicker.tsx` |
| **Push (FCM)** | Saat aplikasi **ditutup** | Endpoint `/api/notifications/dispatch` (dipanggil cron tiap 1–5 menit) menghitung jadwal per perangkat terdaftar dan mengirim FCM | `src/lib/notifications/push.ts`, `src/lib/notifications/dispatcher.ts`, `src/app/api/notifications/dispatch/route.ts`, handler FCM di `public/sw.js` |

Keduanya memakai preferensi per salat yang sama (mode `azan / short / silent /
off` + pengingat `beforeMinutes`) dari Pengaturan → Pengingat Salat.

## Alur push (FCM)

1. Pengguna menyalakan **Push notifikasi (Firebase)** di Pengaturan.
2. Klien meminta izin Notification → membuat **identitas anonymous**
   (Firebase Authentication) → mengambil **token FCM** melalui Service Worker
   `/sw.js` (memuat firebase-messaging-compat dengan guard try/catch agar
   caching offline tidak terganggu).
3. Token + lokasi (kode wilayah, lat/lng, zona waktu) + preferensi per salat
   disimpan di Firestore: `users/{uid}`.
4. Cron memanggil `GET /api/notifications/dispatch?secret=CRON_SECRET`.
5. Server membaca semua `users` dengan `pushEnabled == true`, menghitung
   jadwal hari ini per wilayah (cache Firestore `prayerSchedules` → penyedia
   data), dan mengirim FCM bila:
   - waktu salat masuk (jendela 5 menit), atau
   - pengingat "X menit sebelum" jatuh tempo.
6. Tanda terkirim disimpan di `users/{uid}.lastNotified` (kunci
   `YYYY-MM-DD:key:kind`) sehingga tidak dobel; token mati otomatis dinonaktifkan.
7. Pesan `data` + `webpush.notification` memakai **tag sama**
   (`azanusa-YYYY-MM-DD:key:kind`) — notifikasi di perangkat tergantikan,
   tidak menumpuk.

## Struktur Firestore

```
users/{uid}                       # rules: hanya pemilik uid (anonymous auth)
  pushEnabled: true
  pushToken: "<FCM token>"
  pushPlatform: "web"
  location: { code, name, prov, lat, lng, tz }
  notifications: { subuh: {mode, beforeMinutes}, ... }
  lastNotified: { "2026-11-19:subuh:main": "iso", ... }

prayerSchedules/{regionCode_date} # cache jadwal (publik baca, tulis server saja)
```

## Setup di console Firebase (sekali)

1. **Anonymous Authentication** — Authentication → Sign-in method →
   Anonymous → Enable. (Wajib: Firestore rules memvalidasi `request.auth`.)
2. **Web Push certificate (opsional tapi disarankan)** — Project settings →
   Cloud Messaging → Web Push certificates → Generate key pair → isi ke env
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. Tanpa ini SDK memakai kunci bawaan.
3. **Firestore** — deploy rules: `firebase deploy --only firestore:rules`
   (login CLI dulu: `firebase login`).

## Setup server (cron pengirim)

Server yang menjalankan endpoint dispatch memerlukan env:

```
FIREBASE_PROJECT_ID=azanusa
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@azanusa.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CRON_SECRET=<openssl rand -hex 32>
```

Service account JSON diambil dari Project settings → Service accounts →
Generate new private key. Pada Vercel: masukkan ketiganya di
Settings → Environment Variables.

Kemudian pasang cron eksternal (pilih salah satu):

- **cron-job.org** (gratis): URL `https://DOMAIN/api/notifications/dispatch?secret=XXX`,
  interval 1–5 menit.
- **Vercel Cron**: aktifkan di `vercel.json` (paket Hobby terbatas 1×/hari —
  untuk pengingat salat gunakan cron-job.org).
- **Cloud Functions v2 scheduled** (butuh Blaze): alternatif bila ingin tanpa
  server eksternal.

## Uji cepat

```
curl "http://localhost:3000/api/notifications/dispatch?secret=$CRON_SECRET"
# → { "ok": true, "checked": N, "sent": N, ... }
```

Tombol **Kirim notifikasi uji** di Pengaturan menampilkan notifikasi langsung
dari perangkat untuk memverifikasi izin & Service Worker.
