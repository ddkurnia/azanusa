/** Tipe data inti AZANUSA */

export type TimeZoneId = "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";

export interface Province {
  code: string;
  name: string;
  tz: TimeZoneId;
}

export interface Region {
  code: string; // kode resmi Kemendagri/BPS, contoh: 3171
  name: string; // contoh: Kota Administrasi Jakarta Pusat
  provCode: string;
  prov: string;
  lat: number;
  lng: number;
  tz: TimeZoneId;
}

export type PrayerKey = "subuh" | "zuhur" | "asar" | "magrib" | "isya";

export const PRAYER_KEYS: PrayerKey[] = ["subuh", "zuhur", "asar", "magrib", "isya"];

export const PRAYER_NAMES: Record<PrayerKey, string> = {
  subuh: "Subuh",
  zuhur: "Zuhur",
  asar: "Asar",
  magrib: "Magrib",
  isya: "Isya",
};

/** Waktu salat dalam bentuk instan UTC + tampilan HH:MM di zona waktu wilayah */
export interface PrayerTimeEntry {
  key: PrayerKey;
  utcISO: string;
  display: string; // HH:MM waktu wilayah
}

export interface ExtraTimeEntry {
  key: "imsak" | "terbit";
  utcISO: string;
  display: string;
}

export interface ScheduleSource {
  id: "kemenag-sihat" | "kemenag-mirror" | "aladhan-kemenag" | "astronomical";
  label: string;
  /** true hanya untuk data resmi Kemenag yang terverifikasi (SIHAT) */
  official: boolean;
  /** true bila data berasal langsung dari API resmi; false = estimasi/mirror */
  verified: boolean;
  note: string;
}

export interface PrayerSchedule {
  region: Region;
  /** Tanggal dalam zona waktu wilayah, format YYYY-MM-DD */
  date: string;
  timezone: TimeZoneId;
  times: PrayerTimeEntry[];
  extras: ExtraTimeEntry[];
  source: ScheduleSource;
  syncedAt: string; // ISO UTC
  cache?: "firestore" | "memory" | "none";
}

export type NotifyMode = "azan" | "short" | "silent" | "off";

export interface PrayerNotifySetting {
  mode: NotifyMode;
  /** Pengingat sebelum waktu salat, menit. 0 = nonaktif */
  beforeMinutes: number;
}

export interface AppSettings {
  /** Lokasi aktif pengguna */
  location: Region | null;
  /** Pilihan sumber data */
  dataSource: "auto" | "kemenag" | "mirror" | "calc";
  notifications: Record<PrayerKey, PrayerNotifySetting>;
  /** Volume audio azan 0..1 */
  volume: number;
  /** Audio azan sudah diaktifkan oleh gestur pengguna (syarat autoplay) */
  audioUnlocked: boolean;
}

export interface ProviderStatus {
  kemenagSihatConfigured: boolean;
  mirrorEnabled: boolean;
  firebaseConfigured: boolean;
  defaultSource: ScheduleSource;
}

export interface ApiConfigResponse {
  appVersion: string;
  providers: ProviderStatus;
}
