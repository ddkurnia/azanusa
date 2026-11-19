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

### Status setup (19 Nov 2026 — sudah dipasang via CLI/API)

- ✅ Anonymous Authentication diaktifkan (via identitytoolkit admin API).
- ✅ Firestore rules ter-deploy ke project `azanusa`.
- ✅ Service account `azanusa-dispatch@azanusa.iam.gserviceaccount.com` dibuat
  dengan peran `roles/firebase.admin` + `roles/datastore.user`; kredensialnya
  di `.env` (`FIREBASE_*`) dan tidak pernah di-commit.
- ✅ Uji E2E lolos penuh: izin → anonymous auth → token FCM → Firestore →
  kirim FCM asli → notifikasi diterima perangkat; endpoint dispatch
  menjawab `ok:true` (lihat `scripts/e2e_push_test.mjs`).
- ✅ Produksi terpasang (19 Nov 2026): https://azanusa.vercel.app (Vercel,
  team kedai-media). Env server (`FIREBASE_*`, `CRON_SECRET`) diset via API
  ke environment production/preview/development (`scripts/vercel_env_push.py`).
  Verifikasi produksi: `/api/notifications/dispatch?secret=…` dan
  `/api/notifications/tick` menjawab `checked:2, sent:0` (2 perangkat
  terdaftar, tidak ada salat di jendela 5 menit saat uji); tanpa secret
  ditolak `Secret tidak valid`.
- ⏳ VAPID key belum diisi (opsional): SDK memakai kunci bawaan dan getToken
  terbukti berfungsi. Untuk produksi, isi di Console → Cloud Messaging →
  Web Push certificates lalu set `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

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

- **GitHub Actions (gratis)** — salin file `.github/workflows/push-dispatch.yml`
  ke repo (file sudah disiapkan di sandbox; push-nya butuh token ber-scope
  `workflow`). Dua repo secret **sudah terpasang** via API
  (`scripts/gh_secrets_set.py`, 19 Nov 2026): `PROD_URL`
  (https://azanusa.vercel.app) dan `CRON_SECRET` — begitu file workflow masuk
  repo, cron otomatis jalan tiap 5 menit tanpa langkah tambahan.
- **cron-job.org** (gratis, presisi 1 menit): URL
  `https://DOMAIN/api/notifications/dispatch?secret=XXX`, interval 1–5 menit.
- **Vercel Cron**: aktifkan di `vercel.json` (paket Hobby terbatas 1×/hari —
  untuk pengingat salat gunakan opsi lain).
- **Cloud Functions v2 scheduled** (butuh Blaze): alternatif bila ingin tanpa
  server eksternal.

### Produksi realtime — ringkasan langkah

1. Deploy ke hosting (mis. Vercel). Set env server: `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CRON_SECRET` — kunci
   service account diambil sendiri dari Console Firebase → Project settings →
   Service accounts → Generate new private key.
2. Konfigurasi web client (`NEXT_PUBLIC_FIREBASE_*`) punya fallback bawaan di
   `src/lib/firebase/client.ts` — push aktif bahkan tanpa env itu; env tetap
   dipakai bila diisi.
3. Aktifkan cron pengirim (GitHub Actions di atas, atau cron-job.org) —
   **opsional namun disarankan**: AZANUSA kini punya **tick mandiri**
   (`/api/notifications/tick` + beacon di `PushForeground`) — setiap aplikasi
   yang dibuka pengguna mana pun memicu dispatcher (beacon tiap 4 menit +
   instan saat kembali ke aplikasi/online — di bawah lebar jendela 5 dan 10
   menit agar tak ada jendela terlewat; dibatasi server 1×/menit, dedup per
   hari), sehingga pengingat tetap terkirim tanpa cron. Cron eksternal
   menutup celah saat tidak ada pengguna yang membuka aplikasi.
4. Verifikasi: buka aplikasi di ponsel → Pengaturan → nyalakan **Push
   notifikasi** → "Push aktif — perangkat terdaftar di cloud AZANUSA." →
   cek endpoint dispatch menjawab `checked >= 1`.

Dispatcher mengirim dalam jendela 5 menit sejak waktu salat (dedup per hari),
jadi cron 1–5 menit menghasilkan pengingat tepat waktu saat aplikasi ditutup.

## Uji cepat

```
curl "http://localhost:3000/api/notifications/dispatch?secret=$CRON_SECRET"
# → { "ok": true, "checked": N, "sent": N, ... }
```

Tombol **Kirim notifikasi uji** di Pengaturan menampilkan notifikasi langsung
dari perangkat untuk memverifikasi izin & Service Worker.
