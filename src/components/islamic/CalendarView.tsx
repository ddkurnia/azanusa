"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useNow } from "@/hooks/use-now";
import { hijriDateInTz, formatHijri, hijriMonthGrid, shiftAnchorByMonths } from "@/lib/hijri";
import { weekdayNameInTz } from "@/lib/timezone";
import {
  FASTING_LEVEL_META,
  SUNNAH_FASTING_RULES,
  fastingRulesForDay,
  wholeMonthRules,
  type FastingLevel,
  type SunnahFastingRule,
} from "@/lib/sunnah-fasting";

const WEEKDAY_LONG = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const LEVEL_ORDER: Record<FastingLevel, number> = { dilarang: 0, utama: 1, sunna: 2, makruh: 3 };

interface DayFasting {
  date: string;
  hijriDay: number;
  weekday: number;
  rules: SunnahFastingRule[];
}

/** Banner edukasi khusus per bulan hijriah */
function monthBanner(month: number): { text: string; className: string } | null {
  if (month === 9)
    return {
      text: "Bulan Ramadhan — puasa wajib sebulan penuh. Allah berfirman (QS. Al-Baqarah: 183): “Wahai orang-orang beriman, diwajibkan atas kamu berpuasa sebagaimana diwajibkan atas orang-orang sebelum kamu, agar kamu bertakwa.”",
      className: "border-gold bg-gold/10",
    };
  if (month === 1)
    return {
      text: "Bulan Muharam — “Puasa paling utama setelah Ramadhan adalah puasa bulan Allah, Muharam” (HR. Tirmidzi no. 740, sahih). Perbanyak puasa sunnah; tanggal 9–10 ditandai khusus.",
      className: "border-emerald-az/40 bg-emerald-soft",
    };
  if (month === 8)
    return {
      text: "Bulan Sya'ban — bulan yang paling banyak Nabi ﷺ berpuasa (HR. Bukhari no. 1970). Setelah tanggal 15, tidak disarankan memulai puasa (HR. Tirmidzi no. 738) — diakharkan bagi yang menyambung puasa rutin.",
      className: "border-emerald-az/40 bg-emerald-soft",
    };
  if (month === 12)
    return {
      text: "Bulan Zulhijah — 9 Zulhijah (Arafah) sangat dianjurkan; 10–13 (Idul Adha & hari Tasyriq) haram berpuasa (HR. Bukhari no. 1992; Muslim no. 1121).",
      className: "border-gold bg-gold/10",
    };
  return null;
}

export function CalendarView() {
  const location = useAppStore((s) => s.location);
  const now = useNow(60_000);
  const tz = location?.tz ?? "Asia/Jakarta";
  const [anchor, setAnchor] = useState<Date>(now);
  const [monthOffset, setMonthOffset] = useState(0);

  const grid = useMemo(() => {
    const a = monthOffset === 0 ? anchor : shiftAnchorByMonths(anchor, monthOffset);
    return hijriMonthGrid(a, tz);
  }, [anchor, tz, monthOffset]);

  const todayHijri = hijriDateInTz(now, tz);
  const todayISO = useMemo(() => {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).formatToParts(now);
    return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
  }, [now, tz]);

  // Penandaan puasa per hari + kumpulan entri keterangan bulan ini
  const fastingDays = useMemo(() => {
    const map = new Map<string, DayFasting>();
    for (const d of grid.days) {
      const [y, m, dd] = d.masehiDate.split("-");
      const weekday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd))).getUTCDay();
      const rules = fastingRulesForDay({ day: d.hijri.day, month: d.hijri.month }, weekday);
      map.set(d.masehiDate, { date: d.masehiDate, hijriDay: d.hijri.day, weekday, rules });
    }
    return map;
  }, [grid]);

  // Entri daftar keterangan: aturan bulan-utuh + aturan hari-tetap yang muncul di bulan ini
  const fastingEntries = useMemo(() => {
    const month = grid.days[0]?.hijri.month ?? todayHijri.month;
    const entries: { rule: SunnahFastingRule; dates: DayFasting[] }[] = [];
    // aturan bulan-utuh (Muharam / Sya'ban) — tanpa titik di sel, cukup di daftar
    for (const rule of wholeMonthRules(month)) {
      const dates = grid.days.map((d) => fastingDays.get(d.masehiDate)!).filter(Boolean);
      if (dates.length > 0) entries.push({ rule, dates });
    }
    // aturan hari-tetap: kumpulkan tanggal yang cocok dari grid
    const byRule = new Map<string, DayFasting[]>();
    for (const d of grid.days) {
      const f = fastingDays.get(d.masehiDate);
      if (!f) continue;
      for (const r of f.rules) {
        const arr = byRule.get(r.id) ?? [];
        arr.push(f);
        byRule.set(r.id, arr);
      }
    }
    for (const r of SUNNAH_FASTING_RULES) {
      if (r.monthOf) continue;
      const dates = byRule.get(r.id);
      if (dates && dates.length > 0) entries.push({ rule: r, dates });
    }
    return entries.sort(
      (a, b) =>
        LEVEL_ORDER[a.rule.level] - LEVEL_ORDER[b.rule.level] ||
        (a.dates[0]?.hijriDay ?? 0) - (b.dates[0]?.hijriDay ?? 0)
    );
  }, [grid, fastingDays, todayHijri.month]);

  const banner = monthBanner(grid.days[0]?.hijri.month ?? todayHijri.month);

  if (!location) {
    return (
      <EmptyState
        title="Kalender Hijriah"
        text="Pilih wilayah terlebih dahulu agar tanggal hijriah mengikuti zona waktu wilayah Anda."
      />
    );
  }

  return (
    <div className="space-y-3">
      <section className="animate-fade-up rounded-2xl bg-gradient-to-br from-teal-deep to-emerald-az p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/70">Tanggal hijriah hari ini</p>
            <p className="mt-1 text-2xl font-extrabold">{formatHijri(todayHijri)}</p>
            <p className="mt-1 text-sm text-white/80">{weekdayNameInTz(now, tz)}</p>
          </div>
          <CalendarDays className="h-10 w-10 text-gold-soft" />
        </div>
      </section>

      {banner && (
        <p className={`rounded-xl border p-3 text-xs leading-relaxed text-teal-deep ${banner.className}`}>
          {banner.text}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setMonthOffset((m) => m - 1)}
            className="rounded-xl border border-border p-2 hover:text-primary"
            aria-label="Bulan hijriah sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-bold text-teal-deep">{grid.label}</h3>
          <button
            onClick={() => setMonthOffset((m) => m + 1)}
            className="rounded-xl border border-border p-2 hover:text-primary"
            aria-label="Bulan hijriah berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Aha", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
            <div key={d} className="py-1 text-[10px] font-bold text-muted-foreground">
              {d}
            </div>
          ))}
          {grid.days.map((d, idx) => {
            const [y, m, dd] = d.masehiDate.split("-");
            const weekday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(dd))).getUTCDay();
            const rules = fastingDays.get(d.masehiDate)?.rules ?? [];
            const cells: React.ReactNode[] = [];
            if (idx === 0 && weekday !== 0) {
              for (let i = 0; i < weekday; i++) cells.push(<div key={`pad-${i}`} />);
            }
            cells.push(
              <div
                key={d.masehiDate}
                className={`rounded-lg py-2 ${
                  d.masehiDate === todayISO
                    ? "bg-primary font-bold text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                <span className="block text-sm font-bold">{d.hijri.day}</span>
                <span className="block text-[9px] opacity-70">
                  {Number(dd)}/{Number(m)}
                </span>
                {rules.length > 0 && (
                  <span className="mt-1 flex items-center justify-center gap-0.5">
                    {rules.slice(0, 3).map((r) => (
                      <span
                        key={r.id}
                        className={`h-1.5 w-1.5 rounded-full ${FASTING_LEVEL_META[r.level].dot}`}
                        title={`${r.label} — ${FASTING_LEVEL_META[r.level].nama}`}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
            return cells;
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Menggunakan standar kalender Umm al-Qura. Awal bulan resmi (mis. Ramadhan,
          Syawal, Zulhijah) mengikuti rukyatul hilal dan keputusan pemerintah dapat
          berbeda ±1 hari.
        </p>
      </section>

      {/* Legenda warna */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold text-teal-deep">Keterangan Warna Puasa</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.entries(FASTING_LEVEL_META) as [FastingLevel, (typeof FASTING_LEVEL_META)[FastingLevel]][]).map(
            ([lv, meta]) => (
                <div key={lv} className={`rounded-xl border p-2.5 ${meta.badge}`}>
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.nama}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug opacity-80">{meta.deskripsi}</p>
                </div>
              )
            )}
        </div>
      </section>

      {/* Daftar puasa bulan ini + dalil */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold text-teal-deep">
          Puasa pada Bulan {grid.label.split(" ")[0]} — Dalil & Keterangan
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sesuai Al-Qur'an dan As-Sunnah yang sahih. Titik warna di kalender merujuk daftar ini.
        </p>
        <div className="mt-3 space-y-2.5">
          {fastingEntries.length === 0 && (
            <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              Tidak ada penanda puasa khusus pada bulan ini.
            </p>
          )}
          {fastingEntries.map(({ rule, dates }) => {
            const meta = FASTING_LEVEL_META[rule.level];
            const isWholeMonth = Boolean(rule.monthOf);
            const dateLabel = isWholeMonth
              ? `Seluruh tanggal ${grid.label.split(" ")[0]}`
              : dates.length <= 4
                ? dates.map((d) => `tgl ${d.hijriDay}`).join(", ")
                : `tgl ${dates[0].hijriDay}–${dates[dates.length - 1].hijriDay}`;
            const weekdayInfo = !isWholeMonth && dates.length === 1
              ? ` • ${WEEKDAY_LONG[dates[0].weekday]}`
              : "";
            return (
              <div key={rule.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                    {meta.nama}
                  </span>
                  <span className="text-xs font-bold text-teal-deep">{rule.label}</span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {dateLabel}
                  {weekdayInfo}
                  {!isWholeMonth && dates.length > 1 && dates.length <= 4 && dates.length > 0
                    ? ` (${dates.length} hari)`
                    : ""}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{rule.dalil}</p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-az">{rule.sumber}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{rule.keterangan}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function EmptyState({ title, text, icon: Icon }: { title: string; text: string; icon?: typeof CalendarDays }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      {Icon ? <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" /> : null}
      <h2 className="text-lg font-bold text-teal-deep">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
