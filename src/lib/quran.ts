"use client";

/**
 * Klien data Al-Qur'an AZANUSA — data nyata dari equran.id (API publik).
 * Daftar surat & ayat di-cache di localStorage agar dapat dibuka offline
 * setelah dimuat sekali. Tidak ada data palsu.
 */

export interface SurahMeta {
  nomor: number;
  nama: string; // teks Arab
  namaLatin: string;
  jumlahAyat: number;
  tempatTurun: string; // "Mekah" | "Madinah"
  arti: string;
}

export interface Ayah {
  /** equran.id mengirim "nomorAyat" (string) */
  nomorAyat: string | number;
  teksArab: string;
  teksLatin: string;
  teksIndonesia: string;
}

export interface SurahDetail extends SurahMeta {
  deskripsi?: string;
  ayat: Ayah[];
}

const LIST_KEY = "azanusa-quran-surah-list";
const SURAH_PREFIX = "azanusa-quran-surah-";
/** Simpan maksimal 12 surat terakhir yang dibuka (hemat localStorage) */
const MAX_SURAH_CACHE = 12;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function trimSurahCache() {
  try {
    const keys: { key: string; t: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(SURAH_PREFIX)) {
        const v = safeParse<{ cachedAt?: number }>(localStorage.getItem(k));
        keys.push({ key: k, t: v?.cachedAt ?? 0 });
      }
    }
    if (keys.length <= MAX_SURAH_CACHE) return;
    keys.sort((a, b) => a.t - b.t);
    for (const k of keys.slice(0, keys.length - MAX_SURAH_CACHE)) {
      localStorage.removeItem(k.key);
    }
  } catch {
    // abaikan
  }
}

export function getCachedSurahList(): SurahMeta[] | null {
  if (typeof window === "undefined") return null;
  return safeParse<SurahMeta[]>(localStorage.getItem(LIST_KEY));
}

export function getCachedSurah(nomor: number): SurahDetail | null {
  if (typeof window === "undefined") return null;
  return safeParse<SurahDetail>(localStorage.getItem(SURAH_PREFIX + nomor));
}

/** Ambil daftar 114 surat (cache → jaringan) */
export async function fetchSurahList(signal?: AbortSignal): Promise<SurahMeta[]> {
  const cached = getCachedSurahList();
  if (cached) {
    // segarkan di latar belakang
    fetch("/api/quran?list=1", { signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok && Array.isArray(j.data)) {
          try {
            localStorage.setItem(LIST_KEY, JSON.stringify(j.data));
          } catch {
            // abaikan
          }
        }
      })
      .catch(() => undefined);
    return cached;
  }
  const res = await fetch("/api/quran?list=1", { signal });
  const j = await res.json();
  if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Gagal memuat daftar surat");
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(j.data));
  } catch {
    // abaikan
  }
  return j.data as SurahMeta[];
}

/** Ambil detail surat + ayat (cache → jaringan) */
export async function fetchSurah(nomor: number, signal?: AbortSignal): Promise<SurahDetail> {
  const cached = getCachedSurah(nomor);
  if (cached) {
    fetch(`/api/quran?surah=${nomor}`, { signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok && j.data) {
          try {
            localStorage.setItem(
              SURAH_PREFIX + nomor,
              JSON.stringify({ ...j.data, cachedAt: Date.now() })
            );
            trimSurahCache();
          } catch {
            // abaikan
          }
        }
      })
      .catch(() => undefined);
    return cached;
  }
  const res = await fetch(`/api/quran?surah=${nomor}`, { signal });
  const j = await res.json();
  if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Gagal memuat surat");
  try {
    localStorage.setItem(
      SURAH_PREFIX + nomor,
      JSON.stringify({ ...j.data, cachedAt: Date.now() })
    );
    trimSurahCache();
  } catch {
    // abaikan
  }
  return j.data as SurahDetail;
}
