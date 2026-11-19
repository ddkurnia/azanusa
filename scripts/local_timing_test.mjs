/**
 * Uji deterministik jalur LOKAL AZANUSA (aplikasi terbuka):
 * reminder "N menit lagi" muncul dalam jendela [T-10, T) dan AZAN dicoba
 * diputar tepat pada jendela [T, T+5) — tanpa menyentuh push/Firestore.
 *
 * Cara: jadwal API /api/prayer-times dipalsukan di dalam halaman (fetch
 * di-patch sebelum aplikasi berjalan) — zuhur = sekarang+3 menit (masih di
 * jendela before), asar = sekarang-1 menit (sudah masuk jendela main).
 * ServiceWorkerRegistration.showNotification dan HTMLAudioElement.play
 * direkam; bila keduanya menembak sesuai jendela → LULUS.
 *
 * Jalankan: node --env-file=.env scripts/local_timing_test.mjs
 * (server uji lokal di 127.0.0.1:3100 harus hidup)
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:3100";
const CDP = "http://127.0.0.1:9224";
const CHROME = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[uji-lokal]", ...a);

const iso = (offsetMin) => new Date(Date.now() + offsetMin * 60_000).toISOString();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

// ambil jadwal nyata sebagai template (menjamin bentuk data identik), lalu
// geser waktunya sesuai skenario
const realRes = await fetch(`${BASE}/api/prayer-times?code=3171`);
const realJs = await realRes.json();
const schedule = realJs.schedule;
const shifts = { subuh: -300, zuhur: 3, asar: -1, magrib: 240, isya: 420 };
schedule.times = schedule.times.map((t) => ({ ...t, utcISO: iso(shifts[t.key] ?? 0) }));
log(
  "jadwal palsu:",
  schedule.times.map((t) => `${t.key}=${t.display}(geser ${shifts[t.key] ?? 0}mnt)`).join(", ")
);

const bootstrap = `
  try {
    localStorage.setItem('azanusa-settings', JSON.stringify({state:{location:{code:'3171',name:'Jakarta Pusat',prov:'DKI Jakarta',lat:-6.1823,lng:106.8296,tz:'Asia/Jakarta'},pushEnabled:false},version:1}));
  } catch (e) {}
  window.__notifLog = [];
  window.__audioLog = [];
  if (window.ServiceWorkerRegistration) {
    const oShow = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (...a) {
      window.__notifLog.push(String(a[0]) + ' || tag=' + ((a[1] && a[1].tag) || '-'));
      return oShow.apply(this, a);
    };
  }
  // fallback halaman: new Notification(...)
  try {
    const oNotif = window.Notification;
    function NotifSpy(title, opts) {
      window.__notifLog.push(String(title) + ' || tag=' + ((opts && opts.tag) || '-') + ' (page)');
      return new oNotif(title, opts);
    }
    NotifSpy.prototype = oNotif.prototype;
    NotifSpy.permission = oNotif.permission;
    NotifSpy.requestPermission = oNotif.requestPermission ? oNotif.requestPermission.bind(oNotif) : undefined;
    NotifSpy.maxActions = oNotif.maxActions;
    window.Notification = NotifSpy;
  } catch (e) {}
  const oPlay = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function () {
    // vol=0 dipakai unlock() splash — bedakan dengan azan sesungguhnya
    window.__audioLog.push((this.src || '(tanpa src)') + ' vol=' + this.volume);
    return oPlay.apply(this, arguments);
  };
  const oFetch = window.fetch;
  window.__fetchLog = [];
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    window.__fetchLog.push(url.slice(0, 90));
    if (url.includes('/api/prayer-times')) {
      return Promise.resolve(new Response(JSON.stringify(window.__FAKE_SCHEDULE), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return oFetch.apply(this, arguments);
  };
`;

const PROFILE = `/tmp/chrome-azanusa-local-${Date.now()}`;
const chrome = spawn(
  CHROME,
  ["--headless=new", "--remote-debugging-port=9224", "--no-sandbox", "--disable-dev-shm-usage",
   "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${PROFILE}`, "--window-size=390,844", BASE],
  { stdio: "ignore" }
);
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

let ok = false;
const WATCHDOG = setTimeout(() => {
  console.log("[uji-lokal] WATCHDOG: 70 dtk habis — proses dibunuh");
  process.exit(2);
}, 70_000);
try {
  let ver = null;
  log("menunggu CDP…");
  for (let i = 0; i < 20; i++) {
    try { ver = await (await fetch(CDP + "/json/version")).json(); break; } catch { await sleep(500); }
  }
  if (!ver) throw new Error("CDP tidak mau hidup");
  log("CDP up:", ver.Browser);

  const targets = await (await fetch(CDP + "/json/list")).json();
  log("targets:", targets.map((t) => t.type).join(","));
  const page = targets.find((t) => t.type === "page" && t.url.startsWith(BASE));
  if (!page) throw new Error("page target tidak ditemukan");
  log("page target ok, membuka WebSocket…");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  log("ws terbuka");
  let mid = 0; const pending = new Map();
  const consoleLog = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      consoleLog.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160));
    if (m.method === "Runtime.exceptionThrown")
      consoleLog.push("EXC: " + JSON.stringify(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 160));
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++mid; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("EVAL: " + JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text).slice(0, 300));
    return r.result?.result?.value;
  };
  await send("Page.enable"); await send("Runtime.enable");
  log("sesi runtime siap");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__FAKE_SCHEDULE = ${JSON.stringify({ ok: true, schedule })};` });
  log("skrip jadwal palsu dipasang");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: bootstrap });
  log("skrip spy dipasang");
  await send("Browser.grantPermissions", { permissions: ["notifications"], origin: BASE });
  log("permission notifications di-grant");

  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Mulai Sekarang')); if (b) b.click(); return true; })()`);
  log("halaman jalan, splash ditutup, menunggu mesin lokal…");

  let notifLog = [], audioLog = [], diag = "";
  for (let i = 0; i < 16; i++) {
    await sleep(750);
    notifLog = JSON.parse((await evalJs("JSON.stringify(window.__notifLog||[])")) || "[]");
    audioLog = JSON.parse((await evalJs("JSON.stringify(window.__audioLog||[])")) || "[]");
    if (notifLog.length && audioLog.length) break;
  }
  diag = await evalJs(`(async () => {
    const r = await navigator.serviceWorker.ready;
    return JSON.stringify({
      showType: typeof r.showNotification,
      bodySnippet: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
      fetchLog: (window.__fetchLog || []).slice(0, 8),
      fired: JSON.parse(localStorage.getItem('azanusa-fired') || '{}'),
    });
  })()`);
  log("diagnosa:", diag);
  log("console penting:", consoleLog.slice(0, 8));
  log("notifikasi:", JSON.stringify(notifLog));
  log("audio:", JSON.stringify(audioLog));

  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result?.data) writeFileSync("/tmp/e2e-local-timing.png", Buffer.from(shot.result.data, "base64"));

  const before = notifLog.some((n) => /Salat Zuhur \d+ menit lagi/.test(n) && n.includes(":zuhur:before"));
  const main = notifLog.some((n) => /Waktunya salat Asar/.test(n) && n.includes(":asar:main"));
  const azan = audioLog.some((a) => a.includes("/audio/azan.mp3") && !a.endsWith(" vol=0"));
  const textAccurate = notifLog.some((n) => /Salat Zuhur [3-5] menit lagi/.test(n));
  log(`before: ${before} | main: ${main} | azan dicoba: ${azan} | teks menit akurat: ${textAccurate}`);

  ok = before && main && azan;
  console.log(
    ok
      ? "RESULT=LOCAL_TIMING_OK — reminder sebelum + azan tepat waktu di jalur lokal"
      : "RESULT=LOCAL_TIMING_FAIL"
  );
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.log("[uji-lokal] GAGAL:", e.message);
  console.log("RESULT=LOCAL_TIMING_ERROR");
  process.exitCode = 1;
} finally {
  clearTimeout(WATCHDOG);
  chrome.kill("SIGKILL");
}
