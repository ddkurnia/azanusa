/**
 * E2E push notification AZANUSA — satu proses, satu sesi Chrome CDP:
 *  1. Chrome headless + Browser.grantPermissions(notifications)
 *  2. Set lokasi via localStorage → splash → Pengaturan
 *  3. Patch reg.showNotification (rekaman penerimaan di halaman)
 *  4. Klik toggle "Push notifikasi (Firebase)" → izin + anonymous auth + token FCM + Firestore
 *  5. Verifikasi dokumen users/{uid} via Admin SDK + kirim push FCM ASLI
 *  6. Verifikasi __notifLog (halaman menerima) + endpoint dispatch cron
 *  7. Screenshot + laporan
 *
 * Jalankan: node --env-file=.env scripts/e2e_push_test.mjs
 */
import { spawn } from "node:child_process";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const BASE = "http://127.0.0.1:3100";
const CDP = "http://127.0.0.1:9223";
const CHROME = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[e2e]", ...a);

const PROFILE = `/tmp/chrome-azanusa-e2e-${Date.now()}`;
const chrome = spawn(
  CHROME,
  ["--headless=new", `--remote-debugging-port=9223`, "--no-sandbox", "--disable-dev-shm-usage",
   `--user-data-dir=${PROFILE}`, "--window-size=390,844", BASE],
  { stdio: "ignore" }
);
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

try {
  // ---------- tunggu CDP ----------
  let ver = null;
  for (let i = 0; i < 20; i++) {
    try { ver = await (await fetch(CDP + "/json/version")).json(); break; } catch { await sleep(500); }
  }
  if (!ver) throw new Error("CDP tidak mau hidup");
  log("Chrome", ver.Browser);

  // ---------- sambung ke page ----------
  const targets = await (await fetch(CDP + "/json/list")).json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith(BASE));
  if (!page) throw new Error("page target tidak ditemukan: " + JSON.stringify(targets.map(t => t.url)));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let mid = 0; const pending = new Map();
  const consoleLog = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      consoleLog.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    if (m.method === "Runtime.exceptionThrown")
      consoleLog.push("EXC: " + JSON.stringify(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++mid; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("EVAL: " + JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text).slice(0, 300));
    return r.result?.result?.value;
  };
  await send("Page.enable"); await send("Runtime.enable");

  // ---------- grant permissions (page session dulu, fallback browserContextId) ----------
  {
    const g = await send("Browser.grantPermissions", { permissions: ["notifications"], origin: BASE });
    log("grant (page session):", g.error ? "GAGAL " + JSON.stringify(g.error) : "terkirim");
    await sleep(300);
    let perm = await evalJs("Notification.permission");
    log("permission setelah grant page-session:", perm);
    if (perm !== "granted") {
      const bws = new WebSocket(ver.webSocketDebuggerUrl);
      await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej; });
      const tgt = await new Promise((res) => {
        bws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id) res(m); };
        bws.send(JSON.stringify({ id: 1, method: "Target.getTargets", params: {} }));
      });
      const me = tgt.result?.targetInfos?.find((t) => t.targetId === page.targetId ?? t.url.startsWith(BASE));
      const ctxId = me?.browserContextId;
      const ok = await new Promise((res) => {
        bws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id === 2) res(m); };
        bws.send(JSON.stringify({ id: 2, method: "Browser.grantPermissions",
          params: { permissions: ["notifications"], origin: BASE, ...(ctxId ? { browserContextId: ctxId } : {}) } }));
      });
      log("grant (browser + ctx " + (ctxId ?? "-") + "):", ok.error ? JSON.stringify(ok.error) : "terkirim");
      bws.close();
      await sleep(300);
      perm = await evalJs("Notification.permission");
      log("permission setelah fallback:", perm);
    }
    if (perm !== "granted") throw new Error("Permission notifications tidak bisa di-grant via CDP");
  }

  // ---------- tunggu load ----------
  for (let i = 0; i < 30; i++) { if (await evalJs("document.readyState")) break; await sleep(300); }
  await sleep(1500);

  // ---------- set lokasi + reload ----------
  await evalJs(`localStorage.setItem('azanusa-settings', JSON.stringify({state:{location:{code:'3171',name:'Jakarta Pusat',prov:'DKI Jakarta',lat:-6.1823,lng:106.8296,tz:"Asia/Jakarta"},pushEnabled:false},version:1}))`);
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  log("halaman dimuat ulang dgn lokasi 3171");

  // ---------- splash ----------
  const splash = await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Mulai Sekarang')); if (b) { b.click(); return true; } return false; })()`);
  log("splash 'Mulai Sekarang':", splash);
  await sleep(1200);

  // ---------- buka Pengaturan ----------
  const set = await evalJs(`(() => { const b = document.querySelector('button[aria-label="Pengaturan"]'); if (b) { b.click(); return true; } return false; })()`);
  log("masuk Pengaturan:", set);
  await sleep(800);

  // ---------- patch showNotification ----------
  log("patch showNotification:", await evalJs(
    `navigator.serviceWorker.ready.then(reg => { if (!window.__notifLog) { window.__notifLog = []; const o = reg.showNotification.bind(reg); reg.showNotification = (...a) => { window.__notifLog.push(String(a[0])); return o(...a); }; } return 'patched'; })`
  ));

  // ---------- klik toggle push ----------
  const toggled = await evalJs(`(() => { const b = document.querySelector('button[aria-label="Aktifkan push notifikasi Firebase"]'); if (b) { b.click(); return true; } return false; })()`);
  log("klik toggle push:", toggled);

  // ---------- poll status ----------
  let status = null;
  for (let i = 0; i < 40; i++) {
    await sleep(750);
    status = await evalJs(`(() => {
      const st = (() => { try { return JSON.parse(localStorage.getItem('azanusa-settings') || '{}')?.state || {}; } catch { return {}; } })();
      const msgs = [...document.querySelectorAll('p')].map(p => p.textContent).filter(t => t && /push|token|gagal|Gagal|Firebase|Izin/i.test(t)).slice(0, 5);
      return JSON.stringify({ push: st.pushEnabled === true, perm: Notification.permission, msgs });
    })()`);
    const s = JSON.parse(status);
    if (s.push) break;
  }
  log("status akhir UI:", status);
  log("console penting:", consoleLog.slice(0, 6));

  // ---------- screenshot ----------
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync("/tmp/e2e-push-settings.png", Buffer.from(shot.result.data, "base64"));
    log("screenshot: /tmp/e2e-push-settings.png");
  }

  // ---------- verifikasi Firestore via Admin SDK ----------
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  }, "e2e");
  const db = getFirestore(app);
  const snap = await db.collection("users").where("pushEnabled", "==", true).limit(5).get();
  log("users pushEnabled:", snap.size, "dokumen");
  let token = null, uid = null;
  snap.forEach((d) => {
    const v = d.data();
    uid = d.id; token = v.pushToken;
    log(` - uid=${d.id.slice(0, 8)}… token=${String(v.pushToken).slice(0, 14)}… (len ${String(v.pushToken).length}) loc=${v.location?.code} ${v.location?.name}`);
  });

  if (token) {
    // ---------- kirim push FCM ASLI ----------
    const msgId = await getMessaging(app).send({
      token,
      data: { title: "Uji push AZANUSA", body: "Push Firebase aktif — pengingat salat siap.", tag: "azanusa-uji-e2e", silent: "0" },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title: "Uji push AZANUSA",
          body: "Push Firebase aktif — pengingat salat siap.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "azanusa-uji-e2e",
          lang: "id",
          vibrate: [200, 100, 200],
        },
      },
    });
    log("FCM TERKIRIM, messageId:", msgId);

    // ---------- tunggu halaman menerima ----------
    let notifLog = [];
    for (let i = 0; i < 20; i++) {
      await sleep(750);
      notifLog = (await evalJs("JSON.stringify(window.__notifLog || [])")) ? JSON.parse(await evalJs("JSON.stringify(window.__notifLog || [])")) : [];
      if (notifLog.length) break;
    }
    log("notifikasi diterima halaman (__notifLog):", JSON.stringify(notifLog));
    console.log("RESULT=" + (notifLog.length ? "E2E_FULL_OK" : "E2E_SEND_OK_NOTIF_UNVERIFIED"));
  } else {
    console.log("RESULT=E2E_TOKEN_MISSING");
  }

  // ---------- endpoint dispatch cron ----------
  const disp = await fetch(`${BASE}/api/notifications/dispatch?secret=${process.env.CRON_SECRET}`);
  const djs = await disp.json().catch(() => ({}));
  log("dispatch cron:", disp.status, JSON.stringify(djs).slice(0, 220));
} catch (e) {
  console.log("[e2e] GAGAL:", e.message);
  console.log("RESULT=E2E_ERROR");
} finally {
  chrome.kill("SIGKILL");
}
