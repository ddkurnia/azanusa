/**
 * Konversi Kalender Hijriah menggunakan calendar islamic-umalqura bawaan Intl
 * (standar Umm al-Qura). Untuk kebutuhan ibadah harian; awal bulan resmi
 * mengikuti rukyat/keputusan pemerintah dapat berbeda ±1 hari.
 */
import { dateStrInTz } from "./timezone";

const HIJRI_MONTHS_ID = [
  "Muharam",
  "Safar",
  "Rabiul Awal",
  "Rabiul Akhir",
  "Jumadil Awal",
  "Jumadil Akhir",
  "Rajab",
  "Sya'ban",
  "Ramadhan",
  "Syawal",
  "Zulkaidah",
  "Zulhijah",
];

export interface HijriDate {
  day: number;
  month: number; // 1-12
  year: number;
  monthName: string;
}

export function hijriDateInTz(date: Date, tz: string): HijriDate {
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: tz,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = Number(get("day"));
  const month = Number(get("month"));
  const year = Number(get("year").replace(/[^0-9]/g, ""));
  return { day, month, year, monthName: HIJRI_MONTHS_ID[Math.min(12, Math.max(1, month)) - 1] };
}

export function formatHijri(h: HijriDate): string {
  return `${h.day} ${h.monthName} ${h.year} H`;
}

/** Kalender bulan Hijriah: daftar hari bulan hijriah yang memuat tanggal acuan */
export function hijriMonthGrid(anchor: Date, tz: string): { days: { hijri: HijriDate; masehiDate: string }[]; label: string } {
  const anchorH = hijriDateInTz(anchor, tz);
  // Mulai dari hari 1 bulan hijriah saat ini: telusuri mundur hingga day=1
  const ms = anchor.getTime();
  const startGuess = new Date(ms - (anchorH.day - 1) * 86_400_000);
  // Koreksi bila mundur melewati batas bulan
  let start = startGuess;
  for (let i = 0; i < 3; i++) {
    const h = hijriDateInTz(start, tz);
    if (h.month === anchorH.month && h.year === anchorH.year && h.day !== 1) {
      start = new Date(start.getTime() - (h.day - 1) * 86_400_000);
    } else break;
  }
  const days: { hijri: HijriDate; masehiDate: string }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const h = hijriDateInTz(d, tz);
    if (h.month !== anchorH.month || h.year !== anchorH.year) break;
    days.push({
      hijri: h,
      masehiDate: dateStrInTz(d, tz),
    });
  }
  return { days, label: `${anchorH.monthName} ${anchorH.year} H` };
}

/** Navigasi bulan hijriah: geser anchor ±N bulan hijriah secara kasar */
export function shiftAnchorByMonths(anchor: Date, months: number): Date {
  return new Date(anchor.getTime() + months * 29.7 * 86_400_000);
}
