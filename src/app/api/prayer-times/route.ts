import { NextRequest, NextResponse } from "next/server";
import { fetchSchedule, type ProviderChoice } from "@/lib/prayer/providers";
import { readCache, writeCache, isValidCachedDoc, type CachedScheduleDoc } from "@/lib/firebase/schedule-cache";
import type { PrayerSchedule } from "@/types";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code")?.trim() ?? "";
  const date = params.get("date")?.trim() || null;
  const choice = (params.get("sumber") ?? "auto") as ProviderChoice;

  if (!/^\d{4}$/.test(code)) {
    return errorResponse("Parameter 'code' wajib berupa 4 digit kode wilayah (contoh: 3171)");
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse("Parameter 'date' harus format YYYY-MM-DD");
  }

  // Tanggal default: hari ini di zona waktu wilayah
  let dateISO = date;
  if (!dateISO) {
    // butuh region untuk tahu zona waktu
    const { getRegionByCode } = await import("@/lib/location/regions");
    const region = getRegionByCode(code);
    if (!region) return errorResponse(`Wilayah tidak ditemukan: ${code}`, 404);
    const { dateStrInTz } = await import("@/lib/timezone");
    dateISO = dateStrInTz(new Date(), region.tz);
  }

  // 1) Cache (Firestore / memori)
  const cached = await readCache(code, dateISO);
  if (cached && isValidCachedDoc(cached)) {
    const { getRegionByCode } = await import("@/lib/location/regions");
    const region = getRegionByCode(code)!;
    const schedule = cachedDocToSchedule(cached, region);
    if (schedule) {
      return NextResponse.json({ ok: true, schedule: { ...schedule, cache: "firestore" } });
    }
  }

  // 2) Penyedia data
  try {
    const schedule = await fetchSchedule(code, dateISO, choice);
    // simpan ke cache (firestore bila dikonfigurasi, memori selalu)
    const doc = scheduleToCachedDoc(schedule);
    await writeCache(doc);
    const body: { ok: true; schedule: PrayerSchedule } = {
      ok: true,
      schedule: { ...schedule, cache: "none" },
    };
    return NextResponse.json(body);
  } catch (e) {
    return errorResponse((e as Error).message, 502);
  }
}

function scheduleToCachedDoc(s: PrayerSchedule): CachedScheduleDoc {
  const timesUTC: Record<string, string> = {};
  for (const t of s.times) timesUTC[t.key] = t.utcISO;
  const extrasUTC: Record<string, string> = {};
  for (const t of s.extras) extrasUTC[t.key] = t.utcISO;
  return {
    regionCode: s.region.code,
    regionName: s.region.name,
    date: s.date,
    timezone: s.timezone,
    sourceId: s.source.id,
    sourceLabel: s.source.label,
    sourceOfficial: s.source.official,
    sourceVerified: s.source.verified,
    sourceNote: s.source.note,
    synchronizationTime: s.syncedAt,
    prayerTimesUTC: timesUTC,
    extrasUTC,
  };
}

function cachedDocToSchedule(doc: CachedScheduleDoc, region: PrayerSchedule["region"]): PrayerSchedule | null {
  try {
    const times = ["subuh", "zuhur", "asar", "magrib", "isya"].map((key) => {
      const iso = doc.prayerTimesUTC[key];
      if (!iso) throw new Error(`cache tidak lengkap: ${key}`);
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) throw new Error("waktu cache tidak valid");
      return {
        key: key as PrayerSchedule["times"][number]["key"],
        utcISO: iso,
        display: new Intl.DateTimeFormat("id-ID", {
          timeZone: doc.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(date)
          .replace(/\./g, ":"),
      };
    });
    const extras = (["imsak", "terbit"] as const)
      .filter((k) => doc.extrasUTC?.[k])
      .map((k) => ({
        key: k,
        utcISO: doc.extrasUTC[k],
        display: new Intl.DateTimeFormat("id-ID", {
          timeZone: doc.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(new Date(doc.extrasUTC[k]))
          .replace(/\./g, ":"),
      }));
    return {
      region,
      date: doc.date,
      timezone: doc.timezone as PrayerSchedule["timezone"],
      times,
      extras,
      source: {
        id: doc.sourceId as PrayerSchedule["source"]["id"],
        label: doc.sourceLabel,
        official: doc.sourceOfficial,
        verified: doc.sourceVerified,
        note: doc.sourceNote,
      },
      syncedAt: doc.synchronizationTime,
    };
  } catch {
    return null;
  }
}
