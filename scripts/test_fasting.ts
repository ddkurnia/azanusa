/** Uji mesin puasa sunnah: bun scripts/test_fasting.ts */
import { hijriDateInTz, hijriMonthGrid } from "../src/lib/hijri";
import { fastingRulesForDay, wholeMonthRules } from "../src/lib/sunnah-fasting";

const tz = "Asia/Jakarta";
const now = new Date("2026-11-19T10:00:00+07:00");
const h = hijriDateInTz(now, tz);
console.log("Hari ini:", h.day, h.monthName, h.year, "→ aturan:", fastingRulesForDay({ day: h.day, month: h.month }, 4).map((r) => r.id));
// 19 Nov 2026 = Kamis (9 Jumadil Akhir) → harus "kamis"

const grid = hijriMonthGrid(now, tz);
console.log("Grid:", grid.label, "→", grid.days.length, "hari");
let withDots = 0;
for (const d of grid.days) {
  const [y, m, dd] = d.masehiDate.split("-");
  const wd = new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd))).getUTCDay();
  const rules = fastingRulesForDay({ day: d.hijri.day, month: d.hijri.month }, wd);
  if (rules.length) {
    withDots++;
    console.log(`  ${d.hijri.day} ${grid.label.split(" ")[0]} ${["Aha", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][wd]} → ${rules.map((r) => `${r.id}(${r.level})`).join(", ")}`);
  }
}
console.log("Total hari bertanda:", withDots);

// Ugi Zulhijah: cek prioritas dilarang > bidh (13 Zulhijah = tasyriq + bidh → hanya dilarang)
const z13 = fastingRulesForDay({ day: 13, month: 12 }, 5);
console.log("13 Zulhijah (Jumat):", z13.map((r) => `${r.id}(${r.level})`).join(", "), "← harus tasyriq saja");
// Jumat polos
console.log("Jumat polos:", fastingRulesForDay({ day: 5, month: 3 }, 5).map((r) => r.id).join(", "));
// Sabtu bertepatan bidh (14) → bidh saja
console.log("Sabtu tgl 14:", fastingRulesForDay({ day: 14, month: 3 }, 6).map((r) => r.id).join(", "));
console.log("Bulan 8 whole:", wholeMonthRules(8).map((r) => r.id).join(", "));
console.log("Bulan 3 whole:", wholeMonthRules(3).map((r) => r.id).join(", ") || "(kosong - benar)");
