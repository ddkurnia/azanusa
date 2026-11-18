/**
 * Penyedia data jadwal salat AZANUSA — arsitektur modular.
 *
 * Rantai penyedia (prioritas):
 *  1. kemenag-sihat  : API resmi SIHAT Kemenag (butuh token + registrasi IP —
 *     diajukan lewat https://sihat.kemenag.go.id/pengembang). Aktif otomatis
 *     bila env KEMENAG_SIHAH_API_TOKEN tersedia di server.
 *  2. kemenag-mirror : cermin publik yang mereplikasi data SIHAT/Bimasislam.
 *     TIDAK RESMI — hanya aktif bila diaktifkan eksplisit (env
 *     PRAYER_ENABLE_MIRROR=true atau pengaturan pengguna).
 *  3. astronomical   : perhitungan astronomis lokal (kriteria Kemenag,
 *     dikalibrasi terhadap tabel SIHAT; deviasi umum 0-4 menit). Selalu tersedia.
 *
 * Semua penyedia mengembalikan instan UTC + metadata sumber yang jujur.
 */
import { calculatePrayerTimes, KEMENAG_OPTIONS } from "./calculation";
import { getRegionByCode } from "@/lib/location/regions";
import type { PrayerSchedule, Region, ScheduleSource } from "@/types";
import { PRAYER_KEYS } from "@/types";

export const SOURCES: Record<ScheduleSource["id"], ScheduleSource> = {
  "kemenag-sihat": {
    id: "kemenag-sihat",
    label: "SIHAT Kemenag RI (resmi)",
    official: true,
    verified: true,
    note: "Data jadwal salat resmi Kementerian Agama Republik Indonesia via API SIHAT.",
  },
  "kemenag-mirror": {
    id: "kemenag-mirror",
    label: "Cermin publik (tidak resmi)",
    official: false,
    verified: false,
    note: "Replikasi data SIHAT/Bimasislam Kemenag oleh layanan pihak ketiga (API myQuran). Belum terverifikasi resmi — verifikasi manual disarankan.",
  },
  astronomical: {
    id: "astronomical",
    label: "Perhitungan astronomis (kriteria Kemenag)",
    official: false,
    verified: false,
    note: "Hisab astronomis lokal: Subuh 20°, Isya 18°, Asar Syafi'i, dikalibrasi terhadap tabel SIHAT Kemenag (deviasi umum 0-4 menit).",
  },
};

export interface ProviderContext {
  region: Region;
  dateISO: string; // tanggal di zona waktu wilayah
}

export interface ProviderResult {
  timesUTC: Record<string, Date> | null;
  source: ScheduleSource | null;
  error?: string;
}

function env(name: string): string | undefined {
  return process.env[name];
}

export function isKemenagSihatConfigured(): boolean {
  return Boolean(env("KEMENAG_SIHAH_API_TOKEN"));
}

export function isMirrorEnabled(): boolean {
  return env("PRAYER_ENABLE_MIRROR") === "true";
}

function parseTimeToUTC(dateISO: string, hhmm: string, offsetHours: number): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const [y, mo, d] = dateISO.split("-").map(Number);
  const ms = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2])) - offsetHours * 3_600_000;
  return new Date(ms);
}

function tzOffset(region: Region, dateISO: string): number {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const noon = new Date(Date.UTC(y, mo - 1, d, 12));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: region.tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  });
  const parts = dtf.formatToParts(noon);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24);
  return (asUTC - Date.UTC(y, mo - 1, d, 12)) / 3_600_000;
}

/* ================= Penyedia 1: SIHAT Kemenag (resmi) ================= */

let sihatMapCache: Record<string, string> | null | undefined;

function sihatWilayahCode(regionCode: string): string | null {
  // Pemetaan kode wilayah AZANUSA (Kemendagri/BPS) -> kode wilayah SIHAT.
  // Sumber: env KEMENAG_SIHAH_WILAYAH_MAP (JSON {"3171":"1301", ...}) atau file
  // kemenag-sihat-map.json pada root proyek. Diisi setelah akses API SIHAT
  // disetujui (lihat docs/KEMENAG-SIHAT.md).
  if (sihatMapCache !== undefined) return sihatMapCache?.[regionCode] ?? null;
  const envMap = env("KEMENAG_SIHAH_WILAYAH_MAP");
  if (envMap) {
    try {
      sihatMapCache = JSON.parse(envMap) as Record<string, string>;
      return sihatMapCache[regionCode] ?? null;
    } catch {
      // JSON tidak valid — abaikan
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const file = path.join(process.cwd(), "kemenag-sihat-map.json");
    if (fs.existsSync(file)) {
      sihatMapCache = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, string>;
      return sihatMapCache[regionCode] ?? null;
    }
  } catch {
    // serverless fs terbatas — abaikan
  }
  sihatMapCache = null;
  return null;
}

async function providerKemenagSihat(ctx: ProviderContext): Promise<ProviderResult> {
  const token = env("KEMENAG_SIHAH_API_TOKEN");
  if (!token) return { timesUTC: null, source: null, error: "Token SIHAT belum dikonfigurasi" };
  const wilayah = sihatWilayahCode(ctx.region.code);
  if (!wilayah) return { timesUTC: null, source: null, error: "Kode wilayah SIHAT belum dipetakan" };
  const base = env("KEMENAG_SIHAH_API_BASE_URL") ?? "https://sihat.kemenag.go.id";
  const url = `${base}/api/v1/public/jadwal-salat/harian?wilayah=${encodeURIComponent(wilayah)}&tanggal=${ctx.dateISO}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { timesUTC: null, source: null, error: `SIHAT HTTP ${res.status}` };
    const json = (await res.json()) as Record<string, unknown>;
    const data = (json.data ?? json) as Record<string, unknown>;
    const pick = (...keys: string[]): string | null => {
      for (const k of keys) {
        const v = data[k];
        if (typeof v === "string" && /^\d{1,2}:\d{2}/.test(v)) return v;
      }
      return null;
    };
    const subuh = pick("subuh", "fajr", "imsak_subuh");
    const zuhur = pick("zuhur", "dzuhur", "dhuhr", "lohor");
    const asar = pick("asar", "ashar", "asr");
    const magrib = pick("magrib", "maghrib");
    const isya = pick("isya", "isha");
    const terbit = pick("terbit", "sunrise", "syuruq");
    if (!subuh || !zuhur || !asar || !magrib || !isya) {
      return { timesUTC: null, source: null, error: "Format respons SIHAT tidak dikenali (parser perlu disesuaikan setelah akses disetujui)" };
    }
    const off = tzOffset(ctx.region, ctx.dateISO);
    const timesUTC: Record<string, Date> = {
      subuh: parseTimeToUTC(ctx.dateISO, subuh, off)!,
      zuhur: parseTimeToUTC(ctx.dateISO, zuhur, off)!,
      asar: parseTimeToUTC(ctx.dateISO, asar, off)!,
      magrib: parseTimeToUTC(ctx.dateISO, magrib, off)!,
      isya: parseTimeToUTC(ctx.dateISO, isya, off)!,
    };
    if (terbit) timesUTC.terbit = parseTimeToUTC(ctx.dateISO, terbit, off)!;
    return { timesUTC, source: SOURCES["kemenag-sihat"] };
  } catch (e) {
    return { timesUTC: null, source: null, error: `SIHAT tidak dapat diakses: ${(e as Error).message}` };
  }
}

/* ================= Penyedia 2: cermin publik (opsional, tidak resmi) ================= */

interface MirrorCacheEntry {
  kotaId: string;
  fetchedAt: number;
}
const mirrorKotaCache = new Map<string, MirrorCacheEntry>();

async function mirrorKotaId(region: Region): Promise<string | null> {
  const cached = mirrorKotaCache.get(region.code);
  if (cached && Date.now() - cached.fetchedAt < 30 * 86_400_000) return cached.kotaId;
  const keyword = region.name
    .replace(/^Kota Administrasi\s+/i, "")
    .replace(/^(Kabupaten|Kota)\s+/i, "")
    .trim();
  if (!keyword) return null;
  try {
    const res = await fetch(
      `https://api.myquran.com/v1/sholat/kota/cari/${encodeURIComponent(keyword)}`,
      { signal: AbortSignal.timeout(10_000), cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status: boolean; data?: { id: string; lokasi: string }[] };
    if (!json.status || !json.data?.length) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const target = norm(keyword);
    const best =
      json.data.find((x) => norm(x.lokasi).startsWith(target)) ??
      json.data.find((x) => norm(x.lokasi).includes(target)) ??
      json.data[0];
    mirrorKotaCache.set(region.code, { kotaId: best.id, fetchedAt: Date.now() });
    return best.id;
  } catch {
    return null;
  }
}

async function providerKemenagMirror(ctx: ProviderContext): Promise<ProviderResult> {
  try {
    const kotaId = await mirrorKotaId(ctx.region);
    if (!kotaId) return { timesUTC: null, source: null, error: "Wilayah tidak ditemukan pada cermin publik" };
    const [y, m, d] = ctx.dateISO.split("-").map(Number);
    const res = await fetch(`https://api.myquran.com/v1/sholat/jadwal/${kotaId}/${y}/${m}/${d}`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return { timesUTC: null, source: null, error: `Cermin HTTP ${res.status}` };
    const json = (await res.json()) as {
      status: boolean;
      data?: { jadwal?: Record<string, string> };
    };
    const j = json.data?.jadwal;
    if (!json.status || !j) return { timesUTC: null, source: null, error: "Data cermin tidak lengkap" };
    const off = tzOffset(ctx.region, ctx.dateISO);
    const timesUTC: Record<string, Date> = {};
    const required: [string, string][] = [
      ["subuh", "subuh"],
      ["zuhur", "dzuhur"],
      ["asar", "ashar"],
      ["magrib", "maghrib"],
      ["isya", "isya"],
    ];
    for (const [key, mirrorKey] of required) {
      const t = j[mirrorKey];
      if (!t) return { timesUTC: null, source: null, error: `Waktu ${key} tidak ada pada cermin` };
      const dt = parseTimeToUTC(ctx.dateISO, t, off);
      if (!dt) return { timesUTC: null, source: null, error: `Format waktu ${key} tidak valid` };
      timesUTC[key] = dt;
    }
    if (typeof j.terbit === "string") {
      const terbit = parseTimeToUTC(ctx.dateISO, j.terbit, off);
      if (terbit) timesUTC.terbit = terbit;
    }
    return { timesUTC, source: SOURCES["kemenag-mirror"] };
  } catch (e) {
    return { timesUTC: null, source: null, error: `Cermin tidak dapat diakses: ${(e as Error).message}` };
  }
}

/* ================= Penyedia 3: perhitungan astronomis ================= */

function providerAstronomical(ctx: ProviderContext): ProviderResult {
  const t = calculatePrayerTimes(ctx.dateISO, ctx.region.lat, ctx.region.lng, KEMENAG_OPTIONS);
  return {
    timesUTC: {
      subuh: t.subuh,
      zuhur: t.zuhur,
      asar: t.asar,
      magrib: t.magrib,
      isya: t.isya,
      terbit: t.terbit,
      imsak: t.imsak,
    },
    source: SOURCES.astronomical,
  };
}

/* ================= Penyusunan jadwal ================= */

export type ProviderChoice = "auto" | "kemenag" | "mirror" | "calc";

export async function fetchSchedule(
  regionCode: string,
  dateISO: string,
  choice: ProviderChoice = "auto"
): Promise<Omit<PrayerSchedule, "cache">> {
  const region = getRegionByCode(regionCode);
  if (!region) throw new Error(`Wilayah tidak ditemukan: ${regionCode}`);
  const ctx: ProviderContext = { region, dateISO };

  const attempts: ProviderResult[] = [];
  let result: ProviderResult | null = null;

  function useable(r: ProviderResult): boolean {
    return Boolean(r.timesUTC && r.source);
  }

  if (choice === "kemenag" || choice === "auto") {
    const r = await providerKemenagSihat(ctx);
    attempts.push(r);
    if (useable(r)) result = r;
    else if (choice === "kemenag") throw new Error(r.error ?? "Penyedia resmi tidak tersedia");
  }
  if (!result && (choice === "mirror" || (choice === "auto" && isMirrorEnabled()))) {
    const r = await providerKemenagMirror(ctx);
    attempts.push(r);
    if (useable(r)) result = r;
    else if (choice === "mirror") throw new Error(r.error ?? "Cermin publik tidak tersedia");
  }
  if (!result && (choice === "calc" || choice === "auto")) {
    result = providerAstronomical(ctx);
  }
  if (!result || !useable(result)) {
    const detail = attempts.map((a) => a.error).filter(Boolean).join("; ");
    throw new Error(detail || "Tidak ada penyedia jadwal yang tersedia");
  }

  const times = result.timesUTC!;
  const entries = PRAYER_KEYS.map((key) => ({
    key,
    utcISO: times[key].toISOString(),
    display: new Intl.DateTimeFormat("id-ID", {
      timeZone: region.tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(times[key])
      .replace(/\./g, ":"),
  }));
  const extras = (["imsak", "terbit"] as const)
    .filter((k) => times[k])
    .map((k) => ({
      key: k,
      utcISO: times[k].toISOString(),
      display: new Intl.DateTimeFormat("id-ID", {
        timeZone: region.tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(times[k])
        .replace(/\./g, ":"),
    }));

  return {
    region,
    date: dateISO,
    timezone: region.tz,
    times: entries,
    extras,
    source: result.source!,
    syncedAt: new Date().toISOString(),
  };
}
