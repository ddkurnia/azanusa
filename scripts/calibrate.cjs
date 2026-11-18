/**
 * Kalibrasi parameter ihtiyat AZANUSA terhadap tabel Kemenag (via cermin publik).
 * Grid search minimalisasi selisih absolut maksimum di banyak kota & tanggal.
 */
const fs = require('fs');
const path = require('path');
const { calculatePrayerTimes } = require('../src/lib/prayer/calculation.ts');

const regions = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/regions.json'), 'utf8')
).regencies;

function findRegion(keyword) {
  const k = keyword.toLowerCase();
  return regions.find((r) => r.name.toLowerCase() === k) ||
    regions.find((r) => r.name.toLowerCase().includes(k));
}

const CITIES = [
  { mirrorId: 1631, name: 'Kota Blitar' },
  { mirrorId: 2622, name: 'Kota Makassar' },
  { mirrorId: 1301, name: 'Kota Administrasi Jakarta Selatan' },
  { mirrorId: null, name: 'Kota Jayapura', mirrorName: 'KOTA JAYAPURA' },
  { mirrorId: null, name: 'Kota Banda Aceh', mirrorName: 'KOTA BANDA ACEH' },
  { mirrorId: null, name: 'Kota Sorong', mirrorName: 'KOTA SORONG' },
];

const DATES = ['2026-11-18', '2026-01-15', '2026-06-21', '2026-03-20'];

function fmt(dt, tzOffset) {
  const d = new Date(dt.getTime() + tzOffset * 3600_000);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

async function fetchJadwal(id, y, m, d) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://api.myquran.com/v1/sholat/jadwal/${id}/${y}/${m}/${d}`);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      const json = await res.json();
      if (json.status) return json;
    } catch {}
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

async function fetchSamples() {
  const samples = [];
  for (const city of CITIES) {
    let region = findRegion(city.name.toLowerCase());
    if (!region) throw new Error('Region tidak ditemukan: ' + city.name);
    for (const date of DATES) {
      const [y, m, d] = date.split('-').map(Number);
      const json = await fetchJadwal(city.mirrorId, y, m, d);
      if (!json) { console.log('SKIP', city.name, date); continue; }
      const j = json.data.jadwal;
      if (!j || !j.subuh || !j.isya) { console.log('SKIP invalid', city.name, date); continue; }
      samples.push({ region, date, ref: { subuh: j.subuh, terbit: j.terbit, zuhur: j.dzuhur, asar: j.ashar, magrib: j.maghrib, isya: j.isya }, label: `${region.name} ${date}` });
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return samples;
}

function diffMinutes(mine, ref) {
  if (!mine || !ref) return null;
  const [mh, mm] = mine.split(':').map(Number);
  const [rh, rm] = ref.split(':').map(Number);
  let diff = (mh * 60 + mm) - (rh * 60 + rm);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

function evaluate(samples, iht) {
  let maxAbs = 0;
  let sumAbs = 0;
  let n = 0;
  const perKey = {};
  for (const s of samples) {
    let calc;
    try {
      calc = calculatePrayerTimes(s.date, s.region.lat, s.region.lng, {
        fajrAngle: 20, ishaAngle: 18, asrFactor: 1, ihtiyat: iht,
      });
    } catch { return { maxAbs: 999, sumAbs: 99999, n: 0, perKey: {} }; }
    const tz = s.region.tz === 'Asia/Jakarta' ? 7 : s.region.tz === 'Asia/Makassar' ? 8 : 9;
    for (const key of ['subuh', 'terbit', 'zuhur', 'asar', 'magrib', 'isya']) {
      const diff = diffMinutes(fmt(calc[key], tz), s.ref[key]);
      if (diff === null || Number.isNaN(diff)) continue;
      maxAbs = Math.max(maxAbs, Math.abs(diff));
      sumAbs += Math.abs(diff);
      n++;
      perKey[key] = perKey[key] || { max: 0, sum: 0, n: 0 };
      perKey[key].max = Math.max(perKey[key].max, Math.abs(diff));
      perKey[key].sum += Math.abs(diff);
      perKey[key].n++;
    }
  }
  return { maxAbs, sumAbs, n, perKey };
}

(async () => {
  // lengkapi mirrorId via pencarian nama
  for (const c of CITIES) {
    if (c.mirrorId === null) {
      const q = c.mirrorName || c.name.replace('Kota ', '');
      const res = await fetch(`https://api.myquran.com/v1/sholat/kota/cari/${encodeURIComponent(q)}`);
      const json = await res.json();
      const pick = c.mirrorName
        ? json.data.find((x) => x.lokasi === c.mirrorName)
        : json.data[0];
      c.mirrorId = Number(pick.id);
      console.log('ID', c.name, '->', c.mirrorId, pick.lokasi);
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  const samples = await fetchSamples();
  console.log(`Samples: ${samples.length}`);
  if (samples.length < 10) { console.log('Terlalu sedikit sampel, hentikan.'); process.exit(1); }

  let best = null;
  for (const fajr of [2, 3, 4, 5]) {
    for (const sunrise of [-3, -2, -1, 0]) {
      for (const dhuhr of [3, 4, 5, 6]) {
        for (const asar of [2, 3, 4, 5]) {
          for (const magrib of [3, 4, 5, 6]) {
            for (const isya of [1, 2, 3, 4]) {
              const iht = { fajr, sunrise, dhuhr, asar, magrib, isya };
              const r = evaluate(samples, iht);
              const score = r.maxAbs * 1000 + r.sumAbs / r.n;
              if (!best || score < best.score) best = { score, iht, ...r };
            }
          }
        }
      }
    }
  }
  console.log('BEST ihtiyat:', JSON.stringify(best.iht));
  // detail per sampel untuk outlier
  for (const s of samples) {
    const tz = s.region.tz === 'Asia/Jakarta' ? 7 : s.region.tz === 'Asia/Makassar' ? 8 : 9;
    let calc;
    try {
      calc = calculatePrayerTimes(s.date, s.region.lat, s.region.lng, { fajrAngle: 20, ishaAngle: 18, asrFactor: 1, ihtiyat: best.iht });
    } catch (e) { console.log(s.label, 'ERR', e.message); continue; }
    const diffs = {};
    for (const key of ['subuh', 'zuhur', 'magrib']) {
      diffs[key] = diffMinutes(fmt(calc[key], tz), s.ref[key]);
    }
    console.log(`${s.label.padEnd(36)} tz=${tz} lat=${s.region.lat.toFixed(2)} lng=${s.region.lng.toFixed(2)} -> subuh=${diffs.subuh} zuhur=${diffs.zuhur} magrib=${diffs.magrib}`);
  }
  console.log(`maxAbs=${best.maxAbs} menit, rata-rata=${(best.sumAbs / best.n).toFixed(2)} menit`);
  for (const [k, v] of Object.entries(best.perKey)) {
    console.log(`  ${k}: max=${v.max} rata=${(v.sum / v.n).toFixed(2)}`);
  }
})();
