"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useSchedule } from "@/hooks/use-schedule";
import { useNow } from "@/hooks/use-now";
import { nextPrayerOf, formatCountdown } from "./NextPrayerHero";
import { PrayerTimesList } from "./PrayerTimesList";
import { SourceBadge } from "./SourceBadge";
import { addDaysISO, longDateInTz } from "@/lib/timezone";
import { hijriDateInTz, formatHijri } from "@/lib/hijri";
import { useState } from "react";

export function ScheduleView() {
  const { schedule, tomorrow, loading, error, fromCache } = useSchedule();
  const now = useNow(1000);
  const [offset, setOffset] = useState(0); // 0 = hari ini
  const next = useMemo(() => nextPrayerOf(schedule, tomorrow, now), [schedule, tomorrow, now]);

  const shownSchedule = offset === 0 ? schedule : offset === 1 ? tomorrow : null;
  const shownDate = schedule ? addDaysISO(schedule.date, offset) : null;

  if (!schedule) {
    return (
      <div className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        ) : (
          <div className="animate-pulse rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Memuat jadwal…</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset((o) => Math.max(-7, o - 1))}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:text-primary disabled:opacity-40"
            disabled={offset <= -7}
            aria-label="Hari sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground">
              {offset === 0 ? "Hari ini" : offset === 1 ? "Besok" : offset < 0 ? `${Math.abs(offset)} hari lalu` : `${offset} hari depan`}
            </p>
            <p className="mt-0.5 text-sm font-bold text-teal-deep">
              {shownDate ? longDateInTz(new Date(`${shownDate}T12:00:00Z`), schedule.timezone) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {shownDate ? formatHijri(hijriDateInTz(new Date(`${shownDate}T12:00:00Z`), schedule.timezone)) : ""}
            </p>
          </div>
          <button
            onClick={() => setOffset((o) => Math.min(1, o + 1))}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:text-primary disabled:opacity-40"
            disabled={offset >= 1}
            aria-label="Hari berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {shownSchedule ? (
        <>
          <PrayerTimesList schedule={shownSchedule} nextKey={offset === 0 ? next?.key : undefined} />
          <SourceBadge schedule={shownSchedule} fromCache={fromCache && offset === 0} />
          {offset === 0 && next && (
            <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
              <p className="text-xs text-muted-foreground">Hitung mundur menuju azan {next.display}</p>
              <p className="font-num-tabular mt-1 text-3xl font-extrabold text-primary">
                {formatCountdown(Date.parse(next.utcISO) - now.getTime())}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          {loading ? "Memuat jadwal…" : "Jadwal untuk tanggal ini belum tersedia. Ketuk tombol panah untuk kembali ke hari ini."}
        </div>
      )}
    </div>
  );
}
