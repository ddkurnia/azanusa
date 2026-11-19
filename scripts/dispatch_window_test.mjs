/**
 * Uji deterministik jendela dispatcher AZANUSA (reminder "sebelum" + azan "tepat waktu").
 *
 * Prinsip: tulis cache jadwal PALSU untuk dua wilayah yang TIDAK dipakai user
 * manapun (1101 & 1102), buat dua user uji ber-token INVALID (tidak ada
 * notifikasi nyata terkirim ke siapa pun), lalu panggil endpoint dispatch:
 *   - user A (1101): zuhur = sekarang + 5 menit  → HANYA jendela "before" aktif
 *   - user B (1102): asar = sekarang − 1 menit   → HANYA jendela "main" aktif
 * Bila logika jendela benar, dispatcher mencoba mengirim tepat 1× per user
 * (FCM menolak token palsu → "dead" → 1 error per uid, sent tetap 0).
 *
 * Jalankan: node --env-file=.env scripts/dispatch_window_test.mjs
 * (server uji lokal di 127.0.0.1:3100 harus hidup)
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const BASE = process.env.DISPATCH_BASE ?? "http://127.0.0.1:3100";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[uji-jendela]", ...a);

const app = initializeApp(
  {
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  "uji-jendela"
);
const db = getFirestore(app);

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

const iso = (offsetMin) => new Date(Date.now() + offsetMin * 60_000).toISOString();

function fakeScheduleDoc(regionCode, regionName, timesUTC) {
  return {
    regionCode,
    regionName,
    date: todayJakarta(),
    timezone: "Asia/Jakarta",
    sourceId: "uji-jendela",
    sourceLabel: "Uji jendela (palsu)",
    sourceOfficial: false,
    sourceVerified: true,
    sourceNote: "cache palsu untuk uji jendela — dihapus otomatis",
    synchronizationTime: new Date().toISOString(),
    prayerTimesUTC: timesUTC,
    extrasUTC: {},
  };
}

const far = { subuh: iso(-360), zuhur: iso(-300), asar: iso(240), magrib: iso(360), isya: iso(420) };
const rand = Math.random().toString(36).slice(2, 8);
const UID_A = `zz-timing-before-${rand}`;
const UID_B = `zz-timing-main-${rand}`;
const cacheIds = [];

async function cleanup() {
  await db.collection("users").doc(UID_A).delete().catch(() => {});
  await db.collection("users").doc(UID_B).delete().catch(() => {});
  for (const id of cacheIds) await db.collection("prayerSchedules").doc(id).delete().catch(() => {});
}

try {
  const today = todayJakarta();
  log("hari wilayah uji:", today);

  // A: zuhur 5 menit dari sekarang → jendela before [T-10, T) aktif
  const docA = fakeScheduleDoc("1101", "Kabupaten Aceh Selatan", {
    ...far,
    zuhur: iso(5),
  });
  cacheIds.push(`1101_${today}`);
  await db.collection("prayerSchedules").doc(`1101_${today}`).set(docA);

  // B: asar 1 menit lalu → jendela main [T, T+5) aktif
  const docB = fakeScheduleDoc("1102", "Kabupaten Aceh Tenggara", {
    ...far,
    asar: iso(-1),
  });
  cacheIds.push(`1102_${today}`);
  await db.collection("prayerSchedules").doc(`1102_${today}`).set(docB);

  const prefs = {
    subuh: { mode: "azan", beforeMinutes: 10 },
    zuhur: { mode: "azan", beforeMinutes: 10 },
    asar: { mode: "azan", beforeMinutes: 10 },
    magrib: { mode: "azan", beforeMinutes: 10 },
    isya: { mode: "azan", beforeMinutes: 10 },
  };
  await db.collection("users").doc(UID_A).set({
    pushEnabled: true,
    pushToken: "INVALID_TOKEN_TIMING_TEST_A",
    pushPlatform: "web",
    location: { code: "1101", name: "Kabupaten Aceh Selatan", prov: "Aceh", tz: "Asia/Jakarta" },
    notifications: prefs,
    lastNotified: {},
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("users").doc(UID_B).set({
    pushEnabled: true,
    pushToken: "INVALID_TOKEN_TIMING_TEST_B",
    pushPlatform: "web",
    location: { code: "1102", name: "Kabupaten Aceh Tenggara", prov: "Aceh", tz: "Asia/Jakarta" },
    notifications: prefs,
    lastNotified: {},
    updatedAt: FieldValue.serverTimestamp(),
  });
  log("user uji dibuat:", UID_A, "+", UID_B, "(token invalid — tidak ada push nyata)");

  // panggil dispatch lokal
  const res = await fetch(`${BASE}/api/notifications/dispatch?secret=${process.env.CRON_SECRET}`);
  const js = await res.json();
  log("dispatch:", res.status, JSON.stringify(js));

  const errA = (js.errors ?? []).filter((e) => e.includes(UID_A)).length;
  const errB = (js.errors ?? []).filter((e) => e.includes(UID_B)).length;
  log(`percobaan kirim user A (before): ${errA} | user B (main): ${errB} | deadTokens: ${js.deadTokens}`);

  // Bukti jendela benar: dispatcher mencoba kirim TEPAT 1× per user uji
  // (FCM menolak token palsu → 1 entri error per uid), dan TIDAK ada
  // pengiriman nyata ke user sungguhan (sent === 0).
  const ok = errA === 1 && errB === 1 && js.sent === 0 && js.checked >= 2;
  console.log(
    ok
      ? "RESULT=WINDOW_TEST_OK — jendela before & main keduanya tepat waktu, tanpa kirim dobel"
      : "RESULT=WINDOW_TEST_FAIL"
  );
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.log("[uji-jendela] GAGAL:", e.message);
  console.log("RESULT=WINDOW_TEST_ERROR");
  process.exitCode = 1;
} finally {
  await sleep(500);
  await cleanup();
  log("bersih-bersih: user uji + cache palsu dihapus");
}
