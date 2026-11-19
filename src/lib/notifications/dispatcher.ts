import "server-only";

/**
 * Dispatcher pengingat salat push (server-side).
 *
 * Dipanggil dari /api/notifications/dispatch oleh cron eksternal (cron-job.org,
 * Vercel Cron, dsb.) setiap 1-5 menit. Untuk setiap perangkat terdaftar:
 *  - Ambil jadwal hari ini di zona waktu wilayah (cache Firestore → penyedia data).
 *  - Bandingkan dengan waktu sekarang (bandingkan instan UTC, aman lintas zona).
 *  - Kirim push FCM bila waktu salat masuk / pengingat "x menit sebelum" jatuh tempo.
 *  - Tandai lastNotified agar tidak dobel; matikan token yang kedaluwarsa.
 *
 * Aturan dedup: kunci `${date}:${key}:${kind}` (main|before) pada field
 * lastNotified dokumen users/{uid}. Push di perangkat juga memakai tag sama.
 */
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/server";
import { readCache, writeCache, isValidCachedDoc } from "@/lib/firebase/schedule-cache";
import { fetchSchedule } from "@/lib/prayer/providers";
import { getRegionByCode } from "@/lib/location/regions";
import { dateStrInTz, formatTimeInTz, timeZoneLabel } from "@/lib/timezone";
import { PRAYER_KEYS, PRAYER_NAMES } from "@/types";
import type { TimeZoneId } from "@/types";

const WINDOW_MS = 5 * 60_000; // jendela pengiriman "tepat waktu"
const MAX_USERS_PER_RUN = 500;

interface DispatchSummary {
  checked: number;
  sent: number;
  skipped: number;
  deadTokens: number;
  errors: string[];
  details: { uid: string; kind: string; prayer: string; region: string }[];
}

interface UserDoc {
  pushToken?: string;
  pushEnabled?: boolean;
  location?: { code?: string; name?: string; prov?: string; tz?: string };
  notifications?: Record<string, { mode?: string; beforeMinutes?: number }>;
  lastNotified?: Record<string, string>;
}

export async function dispatchPrayerPushes(): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    deadTokens: 0,
    errors: [],
    details: [],
  };

  const db = await getAdminDb();
  if (!db) throw new Error("Firebase Admin (Firestore) belum dikonfigurasi");
  const messaging = await getAdminMessaging();
  if (!messaging) throw new Error("Firebase Admin (Messaging) belum tersedia");

  const snap = await db
    .collection("users")
    .where("pushEnabled", "==", true)
    .limit(MAX_USERS_PER_RUN)
    .get();
  if (snap.empty) return summary;

  const now = new Date();

  for (const d of snap.docs) {
    const user = d.data() as UserDoc;
    const token = user.pushToken;
    const code = user.location?.code;
    if (!token || !code || !/^\d{4}$/.test(code)) {
      summary.skipped++;
      continue;
    }
    summary.checked++;
    const region = getRegionByCode(code);
    if (!region) {
      summary.skipped++;
      continue;
    }

    const prefs = user.notifications ?? {};
    const lastNotified: Record<string, string> = user.lastNotified ?? {};
    const newMarks: Record<string, string> = {};
    const today = dateStrInTz(now, region.tz);

    let schedule = await buildSchedule(region.code, today, region.tz);
    if (!schedule) {
      summary.errors.push(`jadwal tidak tersedia untuk ${code} ${today}`);
      continue;
    }

    const tzLabel = timeZoneLabel(region.tz);
    const where = `${region.name}, ${region.prov}`;

    for (const key of PRAYER_KEYS) {
      const pref = prefs[key] ?? { mode: "azan", beforeMinutes: 10 };
      if (pref.mode === "off") continue;
      const iso = schedule.timesUTC[key];
      if (!iso) continue;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) continue;

      const silent = pref.mode === "silent";

      // 1) Pengingat sebelum waktu salat
      const before = pref.beforeMinutes ?? 0;
      if (before > 0) {
        const bKey = `${today}:${key}:before`;
        if (now.getTime() >= t - before * 60_000 && now.getTime() < t && !lastNotified[bKey]) {
          const r = await sendPush(messaging, token, {
            title: `Salat ${PRAYER_NAMES[key]} ${before} menit lagi`,
            body: `${schedule.display[key]} ${tzLabel} — ${where}`,
            tag: `azanusa-${bKey}`,
            silent,
          });
          applyResult(summary, d.id, bKey, key, region.code, r, newMarks);
          if (r === "dead") break;
        }
      }

      // 2) Notifikasi tepat waktu
      const mKey = `${today}:${key}:main`;
      if (now.getTime() >= t && now.getTime() < t + WINDOW_MS && !lastNotified[mKey]) {
        const r = await sendPush(messaging, token, {
          title: `Masuk waktu salat ${PRAYER_NAMES[key]}`,
          body: `${schedule.display[key]} ${tzLabel} — ${where}`,
          tag: `azanusa-${mKey}`,
          silent,
        });
        applyResult(summary, d.id, mKey, key, region.code, r, newMarks);
        if (r === "dead") break;
      }
    }

    // Tulis tanda terkirim + bersihkan tanda usulan hari sebelumnya
    if (Object.keys(newMarks).length > 0 || hasStaleMarks(lastNotified, today)) {
      const pruned = Object.fromEntries(
        Object.entries({ ...lastNotified, ...newMarks }).filter(([k]) => k.startsWith(today))
      );
      try {
        await d.ref.update({
          lastNotified: pruned,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (e) {
        summary.errors.push(`update ${d.id} gagal: ${(e as Error).message}`);
      }
    }
  }

  return summary;
}

function applyResult(
  summary: DispatchSummary,
  uid: string,
  markKey: string,
  prayer: string,
  region: string,
  result: "sent" | "dead" | "error",
  newMarks: Record<string, string>
) {
  if (result === "sent") {
    summary.sent++;
    newMarks[markKey] = new Date().toISOString();
    summary.details.push({ uid, kind: markKey.split(":")[2], prayer, region });
  } else if (result === "dead") {
    summary.deadTokens++;
    summary.errors.push(`token mati: ${uid}`);
  } else {
    summary.errors.push(`kirim gagal: ${uid}`);
  }
}

function hasStaleMarks(lastNotified: Record<string, string>, today: string): boolean {
  return Object.keys(lastNotified).some((k) => !k.startsWith(today));
}

type SendResult = "sent" | "dead" | "error";

async function sendPush(
  messaging: import("firebase-admin/messaging").Messaging,
  token: string,
  msg: { title: string; body: string; tag: string; silent: boolean }
): Promise<SendResult> {
  try {
    await messaging.send({
      token,
      data: {
        title: msg.title,
        body: msg.body,
        tag: msg.tag,
        silent: msg.silent ? "1" : "0",
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title: msg.title,
          body: msg.body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: msg.tag,
          silent: msg.silent,
          vibrate: msg.silent ? undefined : [200, 100, 200],
          lang: "id",
        },
      },
    });
    return "sent";
  } catch (e) {
    const code = (e as { code?: number; errorDetails?: string });
    const details = String(code.errorDetails ?? (e as Error).message ?? "");
    if (
      details.includes("registration-token-not-registered") ||
      details.includes("UNREGISTERED") ||
      details.includes("invalid-argument")
    ) {
      return "dead";
    }
    return "error";
  }
}

interface BuiltSchedule {
  timesUTC: Record<string, string>;
  display: Record<string, string>;
}

/** Jadwal hari ini: cache Firestore → penyedia data (mirror/hisab) */
async function buildSchedule(
  code: string,
  today: string,
  tz: TimeZoneId
): Promise<BuiltSchedule | null> {
  const fmt = (iso: string) => formatTimeInTz(new Date(iso), tz);
  const cached = await readCache(code, today);
  if (cached && isValidCachedDoc(cached)) {
    return { timesUTC: cached.prayerTimesUTC, display: mapDisplay(cached.prayerTimesUTC, fmt) };
  }
  try {
    const s = await fetchSchedule(code, today, "auto");
    await writeCache({
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
      prayerTimesUTC: Object.fromEntries(s.times.map((t) => [t.key, t.utcISO])),
      extrasUTC: Object.fromEntries(s.extras.map((t) => [t.key, t.utcISO])),
    });
    return {
      timesUTC: Object.fromEntries(s.times.map((t) => [t.key, t.utcISO])),
      display: Object.fromEntries(s.times.map((t) => [t.key, t.display])),
    };
  } catch {
    return null;
  }
}

function mapDisplay(
  timesUTC: Record<string, string>,
  fmt: (iso: string) => string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, iso] of Object.entries(timesUTC)) {
    try {
      out[k] = fmt(iso);
    } catch {
      // iso rusak — lewati
    }
  }
  return out;
}
