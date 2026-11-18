import type { TimeZoneId } from "@/types";

/**
 * Utilitas zona waktu AZANUSA.
 * Waktu salat selalu mengikuti zona waktu WILAYAH yang dipilih (bukan perangkat):
 * WIB = Asia/Jakarta, WITA = Asia/Makassar, WIT = Asia/Jayapura.
 */

export function timeZoneLabel(tz: TimeZoneId): string {
  return tz === "Asia/Jakarta" ? "WIB" : tz === "Asia/Makassar" ? "WITA" : "WIT";
}

export function timeZoneOffsetHours(tz: TimeZoneId, date = new Date()): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 3_600_000;
}

/** Format instan menjadi HH:MM di zona waktu tertentu (dengan titik dua, konvensi jadwal salat) */
export function formatTimeInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
}

/** HH:MM standar AZANUSA dari Intl formatter apa pun */
export function normalizeHHMM(s: string): string {
  return s.replace(/\./g, ":");
}

/** YYYY-MM-DD untuk instan tertentu pada zona waktu tertentu */
export function dateStrInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hari dalam seminggu (nama Indonesia) untuk tanggal di zona waktu wilayah */
export function weekdayNameInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "long" }).format(date);
}

/** Tanggal lengkap Indonesia: "Rabu, 18 November 2026" */
export function longDateInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** HH:MM:SS jam berjalan di zona waktu wilayah */
export function clockInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
}

/** Menambahkan N hari pada tanggal wilayah (YYYY-MM-DD) dengan aman */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
