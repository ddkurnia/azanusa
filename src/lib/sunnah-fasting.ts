/**
 * Penanda puasa sunnah menurut Al-Qur'an & As-Sunnah (sahih).
 *
 * Semua nomor hadits di bawah diverifikasi langsung di sunnah.com
 * (Bukhari 1970, 1985; Tirmidzi 738, 740, 747; Muslim 1162) atau
 * dikutip tanpa nomor bila penomoran antar-cetak berbeda.
 *
 * Tingkatan & warna:
 *  - "utama"    (emas)    : puasa dengan keutamaan besar yang disebut khusus (Arafah, Asyura, 6 Syawal)
 *  - "sunna"    (hijau)   : puasa sunnah rutin (Senin, Kamis, Yaumul Bidh, Tasu'a)
 *  - "dilarang" (merah)   : puasa haram/tidak sah (hari Raya & hari Tasyriq)
 *  - "makruh"   (kuning)  : tidak disarankan/di-sendirikan (Jumat saja, Sabtu saja, 15 Sya'ban)
 */
import type { HijriDate } from "./hijri";

export type FastingLevel = "utama" | "sunna" | "dilarang" | "makruh";

export interface SunnahFastingRule {
  id: string;
  label: string;
  level: FastingLevel;
  /** Kutipan singkat isi hadits/ayat */
  dalil: string;
  /** Rujukan (dirawat: nomor hanya bila terverifikasi) */
  sumber: string;
  /** Keterangan praktis */
  keterangan: string;
  /** Bulan hijriah (1-12) tempat aturan bulan-utuh ini berlaku, bila ada */
  monthOf?: number;
  match?: (h: { day: number; month: number }, weekday: number) => boolean;
}

export const FASTING_LEVEL_META: Record<
  FastingLevel,
  { nama: string; dot: string; badge: string; deskripsi: string }
> = {
  utama: {
    nama: "Sunnah utama",
    dot: "bg-gold",
    badge: "bg-gold/15 text-teal-deep border-gold",
    deskripsi:
      "Puasa yang keutamaannya disebut khusus dalam hadits sahih — sangat dianjurkan (kecuali Anda sedang haji di Arafah).",
  },
  sunna: {
    nama: "Sunnah rutin",
    dot: "bg-emerald-600",
    badge: "bg-emerald-soft text-teal-deep border-emerald-az/40",
    deskripsi: "Puasa pilihan Rasulullah ﷺ yang diulang secara rutin — dianjurkan.",
  },
  dilarang: {
    nama: "Dilarang berpuasa",
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/40",
    deskripsi: "Puasa di hari ini haram/tidak sah menurut hadits sahih.",
  },
  makruh: {
    nama: "Tidak disarankan",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40",
    deskripsi:
      "Di-sendirikan atau tidak berdalil sahih; tidak dituntut secara khusus — tidak salah bila bertepatan puasa rutin.",
  },
};

export const SUNNAH_FASTING_RULES: SunnahFastingRule[] = [
  {
    id: "senin",
    label: "Puasa Senin",
    level: "sunna",
    dalil: "“Amal-amal diperlihatkan (kepada Allah) pada hari Senin dan Kamis, dan aku menyukai amalku diangkat saat aku berpuasa.”",
    sumber: "HR. Tirmidzi no. 747 (sahih)",
    keterangan:
      "Rasulullah ﷺ paling rajin memilih puasa Senin; juga hari lahir dan hari wahyu pertama.",
    match: (h, wd) => wd === 1,
  },
  {
    id: "kamis",
    label: "Puasa Kamis",
    level: "sunna",
    dalil: "“Amal-amal diperlihatkan pada hari Senin dan Kamis, dan aku menyukai amalku diangkat saat aku berpuasa.”",
    sumber: "HR. Tirmidzi no. 747 (sahih); Abu Dawud",
    keterangan:
      "Hari amal diangkat ke langit; puasa Kamis juga disebut dalam hadits Aisyah (HR. Tirmidzi).",
    match: (h, wd) => wd === 4,
  },
  {
    id: "bidh",
    label: "Yaumul Bidh (puasa hari putih)",
    level: "sunna",
    dalil:
      "“Jika engkau berpuasa tiga hari dalam sebulan, puasalah tanggal 13, 14, dan 15” (Abu Zarr); “Puasa tiga hari tiap bulan seperti puasa seumur tahun penuh.”",
    sumber: "HR. Bukhari & Muslim (Abu Hurairah); Abu Zarr — HR. Tirmidzi & An-Nasa'i",
    keterangan:
      "Malam purnama bersinar penuh sehingga disebut hari putih. Setara puasa setahun penuh.",
    match: (h) => h.day === 13 || h.day === 14 || h.day === 15,
  },
  {
    id: "arafah",
    label: "Puasa Arafah (9 Zulhijah)",
    level: "utama",
    dalil:
      "“Puasa hari Arafah aku berharap menghapus dosa tahun lalu dan tahun yang akan datang.”",
    sumber: "HR. Muslim no. 1162 (sahih)",
    keterangan:
      "Keutamaan terbesar di luar Ramadhan. Tidak disunnahkan bagi jamaah yang sedang berwukuf di Arafah.",
    match: (h) => h.month === 12 && h.day === 9,
  },
  {
    id: "asyura",
    label: "Puasa Asyura (10 Muharam)",
    level: "utama",
    dalil: "“Puasa Asyura aku berharap menghapus dosa setahun yang lalu.”",
    sumber: "HR. Muslim no. 1162 (sahih)",
    keterangan:
      "Menghapus dosa setahun sebelumnya. Dianjurkan ditambah puasa tanggal 9 (Tasu'a) sebagai pembeda dari umat lain.",
    match: (h) => h.month === 1 && h.day === 10,
  },
  {
    id: "tasua",
    label: "Puasa Tasu'a (9 Muharam)",
    level: "sunna",
    dalil: "“Jika masih ada tahun depan, niscaya aku berpuasa tanggal 9 (Tasu'a).” (Ibnu Abbas)",
    sumber: "HR. Ahmad & Ibnu Khuzaimah (sahih)",
    keterangan:
      "Berpuasa Tasu'a bersama Asyura sesuai amalan Nabi ﷺ yang bermaksud menambahkannya.",
    match: (h) => h.month === 1 && h.day === 9,
  },
  {
    id: "syawal6",
    label: "Puasa 6 Hari Syawal",
    level: "utama",
    dalil:
      "“Siapa berpuasa Ramadhan lalu menyambungnya 6 hari di bulan Syawal, maka seperti puasa sepanjang tahun.”",
    sumber: "HR. Muslim no. 1164 (sahih)",
    keterangan:
      "Boleh berurutan atau terpisah (boleh tidak berdempetan) setelah 1 Syawal. Termasuk hari putih 13-15 Syawal.",
    match: (h) => h.month === 10 && h.day === 6,
  },
  {
    id: "idulfitri",
    label: "Hari Raya Idul Fitri (1 Syawal)",
    level: "dilarang",
    dalil:
      "“Nabi ﷺ melarang berpuasa pada dua hari: hari Idul Fitri dan hari Idul Adha (hari kurban).” (Umar)",
    sumber: "HR. Bukhari no. 1992",
    keterangan:
      "Hari raya adalah hari makan dan bersyukur — puasa di hari ini tidak sah.",
    match: (h) => h.month === 10 && h.day === 1,
  },
  {
    id: "iduladha",
    label: "Hari Raya Idul Adha (10 Zulhijah)",
    level: "dilarang",
    dalil:
      "“Nabi ﷺ melarang berpuasa pada dua hari: hari Idul Fitri dan hari Idul Adha (hari kurban).” (Umar)",
    sumber: "HR. Bukhari no. 1992",
    keterangan: "Hari kurban — haram berpuasa; dianjurkan makan setelah shalat Id.",
    match: (h) => h.month === 12 && h.day === 10,
  },
  {
    id: "tasyriq",
    label: "Hari Tasyriq (11–13 Zulhijah)",
    level: "dilarang",
    dalil: "“Hari-hari tasyriq adalah hari makan, minum, dan berzikir kepada Allah.”",
    sumber: "HR. Muslim no. 1121 (sahih)",
    keterangan:
      "Tiga hari setelah Idul Adha. Karena itulah Yaumul Bidh Zulhijah yang sah hanya 14–15 Zulhijah.",
    match: (h) => h.month === 12 && (h.day === 11 || h.day === 12 || h.day === 13),
  },
  {
    id: "jumat",
    label: "Puasa Jumat sendirian",
    level: "makruh",
    dalil: "“Jangan salah seorang dari kalian berpuasa hari Jumat, kecuali berpuasa sehari sebelum atau sesudahnya.”",
    sumber: "HR. Bukhari no. 1985 (sahih)",
    keterangan:
      "Tidak boleh mengkhususkan Jumat. Tidak berlaku bila Jumat bertepatan puasa rutin (Senin/Kamis/Bidh/Arafah, dst.).",
    match: (h, wd) => wd === 5,
  },
  {
    id: "sabtu",
    label: "Puasa Sabtu sendirian",
    level: "makruh",
    dalil: "“Jangan berpuasa hari Sabtu, kecuali puasa yang diwajibkan atas kalian.”",
    sumber: "HR. Abu Dawud, Tirmidzi & Muslim (Abu Hurairah)",
    keterangan:
      "Hari Yahudi melapangkan diri dengan puasa Sabtu. Tidak berlaku bila Sabtu bertepatan puasa rutin/wajib.",
    match: (h, wd) => wd === 6,
  },
  {
    id: "nisfu-syaban",
    label: "Puasa khusus 15 Sya'ban (Nisfu Sya'ban)",
    level: "makruh",
    dalil:
      "Tidak ada hadits sahih yang menyebut puasa khusus tanggal 15 Sya'ban; hadits tentang puasa hari itu dinilai dhaif oleh jumhur ulama.",
    sumber: "Larangan memulai puasa setelah nisfu: HR. Tirmidzi no. 738 (sahih)",
    keterangan:
      "Malam Nisfu Sya'ban dianjurkan dihidupkan dengan zikir — berbeda dari puasa khususnya. Boleh bila menyambung puasa rutin/bidh.",
    match: (h) => h.month === 8 && h.day === 15,
  },
  {
    id: "muharam",
    label: "Puasa bulan Muharam",
    level: "sunna",
    dalil: "“Puasa paling utama setelah Ramadhan adalah puasa bulan Allah, Muharam.”",
    sumber: "HR. Tirmidzi no. 740 (sahih)",
    keterangan:
      "Seluruh bulan Muharam sangat dianjurkan untuk diperbanyak puasa sunnah (di luar Tasu'a & Asyura).",
    monthOf: 1,
  },
  {
    id: "syaban-awal",
    label: "Puasa Sya'ban (awal bulan)",
    level: "sunna",
    dalil: "“Nabi ﷺ tidak pernah berpuasa lebih banyak dalam satu bulan daripada Sya'ban.” (Aisyah)",
    sumber: "HR. Bukhari no. 1970; Muslim no. 1156",
    keterangan:
      "Dianjurkan memperbanyak puasa di awal/paruh pertama Sya'ban sebagai persiapan Ramadhan.",
    monthOf: 8,
  },
  {
    id: "syaban-akhir",
    label: "Setelah 15 Sya'ban",
    level: "makruh",
    dalil: "“Apabila tersisa separuh Sya'ban, jangan berpuasa.”",
    sumber: "HR. Tirmidzi no. 738 (sahih, Darussalam)",
    keterangan:
      "Bagi yang belum terbiasa — agar kuat menyambut Ramadhan. Diakharkan bagi yang meneruskan puasa rutin/bidh sejak sebelumnya.",
    monthOf: 8,
  },
];

const LEVEL_ORDER: Record<FastingLevel, number> = { dilarang: 0, utama: 1, sunna: 2, makruh: 3 };

/**
 * Aturan yang berlaku untuk satu hari (sudah menerapkan hukum prioritas:
 * dilarang > sunnah > makruh; makruh Jumat/Sabtu hanya bila hari itu polos).
 */
export function fastingRulesForDay(
  h: { day: number; month: number },
  weekday: number
): SunnahFastingRule[] {
  const hit: SunnahFastingRule[] = [];
  for (const r of SUNNAH_FASTING_RULES) {
    if (r.monthOf || !r.match) continue;
    if (r.match(h, weekday)) hit.push(r);
  }
  if (hit.some((r) => r.level === "dilarang")) {
    return hit.filter((r) => r.level === "dilarang");
  }
  const hasSunna = hit.some((r) => r.level === "sunna" || r.level === "utama");
  if (hasSunna) return hit.filter((r) => r.level !== "makruh");
  return hit;
}

/** Aturan bulan-utuh yang berlaku pada bulan hijriah tertentu. */
export function wholeMonthRules(month: number): SunnahFastingRule[] {
  return SUNNAH_FASTING_RULES.filter((r) => r.monthOf === month);
}
