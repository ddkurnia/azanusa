/**
 * Cache jadwal salat AZANUSA.
 * Struktur Firestore: prayerSchedules/{regionId_date}
 *   { region, date, timezone, source, synchronizationTime, prayerTimes: {...} }
 * Bila Firestore tidak dikonfigurasi, memakai cache memori proses.
 */
import "server-only";
import { getAdminDb, isAdminConfigured } from "./server";

const MEMORY_CACHE = new Map<string, { data: unknown; expiresAt: number }>();
const MEMORY_TTL_MS = 6 * 3_600_000; // 6 jam

export interface CachedScheduleDoc {
  regionCode: string;
  regionName: string;
  date: string;
  timezone: string;
  sourceId: string;
  sourceLabel: string;
  sourceOfficial: boolean;
  sourceVerified: boolean;
  sourceNote: string;
  synchronizationTime: string;
  prayerTimesUTC: Record<string, string>; // key -> ISO UTC
  extrasUTC: Record<string, string>;
}

export function docId(regionCode: string, date: string): string {
  return `${regionCode}_${date}`;
}

export async function readCache(regionCode: string, date: string): Promise<CachedScheduleDoc | null> {
  const id = docId(regionCode, date);
  // 1) memori
  const mem = MEMORY_CACHE.get(id);
  if (mem && mem.expiresAt > Date.now()) return mem.data as CachedScheduleDoc;
  // 2) Firestore
  if (!isAdminConfigured()) return null;
  try {
    const db = await getAdminDb();
    if (!db) return null;
    const snap = await db.collection("prayerSchedules").doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as CachedScheduleDoc;
    // Cache valid bila sumbernya resmi/terverifikasi; cache perhitungan hanya dipakai 1 hari
    if (data.date !== date) return null;
    const fresh = Date.parse(data.synchronizationTime);
    const ageHours = (Date.now() - fresh) / 3_600_000;
    if (data.sourceVerified && ageHours > 12) return null;
    if (!data.sourceVerified && ageHours > 18) return null;
    MEMORY_CACHE.set(id, { data, expiresAt: Date.now() + MEMORY_TTL_MS });
    return data;
  } catch (e) {
    console.error("[cache] baca Firestore gagal:", (e as Error).message);
    return null;
  }
}

export async function writeCache(doc: CachedScheduleDoc): Promise<void> {
  const id = docId(doc.regionCode, doc.date);
  MEMORY_CACHE.set(id, { data: doc, expiresAt: Date.now() + MEMORY_TTL_MS });
  if (!isAdminConfigured()) return;
  try {
    const db = await getAdminDb();
    if (!db) return;
    await db.collection("prayerSchedules").doc(id).set(doc, { merge: false });
  } catch (e) {
    console.error("[cache] tulis Firestore gagal:", (e as Error).message);
  }
}

/** Validasi struktur dokumen sebelum dipercaya */
export function isValidCachedDoc(doc: unknown): doc is CachedScheduleDoc {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  return (
    typeof d.regionCode === "string" &&
    typeof d.date === "string" &&
    typeof d.prayerTimesUTC === "object" &&
    d.prayerTimesUTC !== null &&
    typeof (d.prayerTimesUTC as Record<string, unknown>).subuh === "string"
  );
}
