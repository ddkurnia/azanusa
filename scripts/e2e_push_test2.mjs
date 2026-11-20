/**
 * E2E push AZANUSA di produksi:
 * izin notifikasi → aktifkan push (anonymous auth + token FCM + Firestore)
 * → kirim push uji via /api/notifications/test → verifikasi notifikasi tampil.
 * Jalankan: NODE_PATH=$(npm root -g) node scripts/e2e_push_test2.mjs
 */
import { chromium } from "playwright";

const BASE = "https://azanusa.vercel.app";
const SHOT = "/tmp/render/e2e-push.png";

const log = (...a) => console.log("[e2e]", ...a);

// channel 'chromium' (headless baru) + persistent context: Push API tidak
// tersedia di konteks incognito bawaan Playwright (crbug 401439).
const context = await chromium.launchPersistentContext("/tmp/pw-profile-azanusa-e2e", {
  headless: true,
  channel: "chromium",
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
});
await context.grantPermissions(["notifications"], { origin: BASE });

const page = context.pages()[0] ?? (await context.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

// Splash → Mulai
const mulai = page.getByRole("button", { name: /Mulai Sekarang/i });
if (await mulai.isVisible().catch(() => false)) {
  await mulai.click();
  log("splash selesai");
}

// Pilih wilayah — sheet mungkin sudah terbuka otomatis setelah splash
const cari = page.getByRole("textbox", { name: /Cari wilayah/i });
if (!(await cari.isVisible().catch(() => false))) {
  await page.getByRole("button", { name: /Pilih Wilayah/i }).click();
  await page.waitForTimeout(1000);
}
await cari.fill("Meranti");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Kepulauan Meranti/i }).click();
log("wilayah: Kabupaten Kepulauan Meranti");
await page.waitForTimeout(2500);

// Ke Pengaturan
await page.evaluate(() => {
  window.location.hash = "#/pengaturan";
});
await page.waitForTimeout(2000);

// Aktifkan push
const sw = page.getByRole("switch", { name: /Aktifkan push notifikasi/i });
await sw.scrollIntoViewIfNeeded();
await sw.click();
log("toggle push diklik — menunggu registrasi FCM…");

try {
  await page.getByText(/Push aktif — perangkat terdaftar/i).waitFor({ timeout: 45000 });
  log("OK: push terdaftar di cloud");
} catch {
  log("GAGAL: pesan 'Push aktif' tidak muncul");
  const msg = await page.locator("section >> nth=0").textContent().catch(() => "");
  log("pesan pengaturan:", (msg || "").slice(0, 200));
}

// Kirim push uji (cloud)
const btn = page.getByRole("button", { name: /Kirim push uji/i });
if (await btn.isVisible().catch(() => false)) {
  await btn.click();
  log("tombol push uji diklik — menunggu jawaban server…");
  try {
    await page.getByText(/Push uji terkirim|FCM menolak|Tunggu 2 menit|tidak aktif|belum terdaftar/i).waitFor({ timeout: 30000 });
    const t = await page.evaluate(() => document.body.innerText.match(/Push uji terkirim[^\n]*|FCM menolak[^\n]*|Push tidak aktif[^\n]*/)?.[0] ?? "?");
    log("hasil tombol:", t);
  } catch {
    log("GAGAL: tidak ada umpan balik push uji");
  }
} else {
  log("tombol push uji tidak ditemukan");
}

// Verifikasi notifikasi benar-benar tampil di service worker
await page.waitForTimeout(4000);
const notifs = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  const reg = regs[0];
  const list = reg ? await reg.getNotifications() : [];
  return {
    swCount: regs.length,
    swUrl: regs[0]?.active?.scriptURL ?? "-",
    notifications: list.map((n) => ({ title: n.title, tag: n.tag })),
  };
});
log("service worker:", notifs.swUrl, `(${notifs.swCount} registrasi)`);
log("notifikasi aktif:", JSON.stringify(notifs.notifications));

const azanNotif = notifs.notifications.some((n) => /Push uji AZANUSA/i.test(n.title));
log(azanNotif ? "E2E LOLOS: push uji FCM tampil sebagai notifikasi" : "E2E: notifikasi push uji TIDAK terdeteksi di perangkat uji");

await page.screenshot({ path: SHOT, fullPage: false });
log("screenshot:", SHOT);
if (errors.length) log("console/page errors:", errors.slice(0, 5).join(" || ").slice(0, 400));
else log("tanpa error konsol");

await context.close();
