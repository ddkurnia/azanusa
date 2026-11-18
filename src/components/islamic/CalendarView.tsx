"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useNow } from "@/hooks/use-now";
import { hijriDateInTz, formatHijri, hijriMonthGrid, shiftAnchorByMonths } from "@/lib/hijri";
import { weekdayNameInTz } from "@/lib/timezone";

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
