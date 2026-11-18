# Panduan Integrasi SIHAT Kemenag (API Resmi)

AZANUSA memprioritaskan data jadwal salat resmi dari **Sistem Informasi Jadwal Salat
(SIHAT) Kementerian Agama RI**. Halaman pengembang resmi:
<https://sihat.kemenag.go.id/pengembang>

## 1. Mengajukan Akses

1. Buka <https://sihat.kemenag.go.id/pengembang> → **Ajukan Akses**.
2. Isi identitas lembaga/perorangan, gambaran pemanfaatan data, dan taksiran jumlah
   permintaan per hari.
3. Menunggu telaah petugas (hasil dikirim melalui email).
4. Setelah disetujui, **token API** diterbitkan (token bersifat pribadi, memiliki batas
   pemakaian dan masa berlaku, dapat dikunci ke alamat IP).

## 2. Format API (per dokumentasi SIHAT)

```http
GET /api/v1/public/jadwal-salat/harian?wilayah=<kode>&tanggal=<YYYY-MM-DD>
Authorization: Bearer <token-anda>
```

- `wilayah` memakai kode wilayah SIHAT (contoh pada dokumentasi resmi: `3171`).
- Kewajiban penggunaan: setiap tampilan data wajib mencantumkan
  **"Kementerian Agama Republik Indonesia"** sebagai sumber. AZANUSA menampilkannya
  pada lencana sumber (label "SIHAT Kemenag RI (resmi)").

## 3. Konfigurasi di AZANUSA

Tambahkan environment variables (lokal: `.env.local`; produksi: dashboard Vercel):

```
KEMENAG_SIHAH_API_BASE_URL=https://sihat.kemenag.go.id
KEMENAG_SIHAH_API_TOKEN=<token-dari-kemenag>
KEMENAG_SIHAH_WILAYAH_MAP={"3171":"3171", "3273":"...", ...}
```

- `KEMENAG_SIHAH_API_TOKEN` — tanpa variabel ini, penyedia resmi otomatis nonaktif dan
  aplikasi memakai perhitungan astronomis (status ditampilkan di UI, tidak pernah
  diklaim resmi).
- `KEMENAG_SIHAH_WILAYAH_MAP` — JSON pemetaan **kode wilayah AZANUSA (Kemendagri/BPS
  4 digit)** → **kode wilayah SIHAT**. Bila kolom wilayah SIHAT sama dengan kode BPS,
  cukup salin pasangan kode dari `src/data/regions.json`.
- Alternatif file: buat `kemenag-sihat-map.json` di root proyek dengan isi JSON yang sama.

## 4. Sesuaikan Parser Bila Perlu

Implementasi penyedia: `src/lib/prayer/providers.ts` → `providerKemenagSihat()`.
Parser membaca kunci umum (`subuh/fajr`, `dzuhur/dhuhr`, `ashar/asr`, `maghrib`,
`isya/isha`, `terbit/sunrise`). Bila format respons SIHAT berbeda setelah token aktif,
sesuaikan fungsi `pick()` di provider tersebut — struktur kode sengaja modular agar
perubahan ini lokal.

## 5. Verifikasi

Setelah konfigurasi aktif:

```bash
curl "http://localhost:3000/api/prayer-times?code=3171&sumber=kemenag"
```

Respons yang benar memuat `source.id = "kemenag-sihat"`, `source.official = true`.
Lencana beranda akan berubah menjadi hijau (resmi & terverifikasi) otomatis.
