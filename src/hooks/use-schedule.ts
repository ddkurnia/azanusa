"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrayerSchedule } from "@/types";
import { dateStrInTz, addDaysISO } from "@/lib/timezone";
import { useAppStore } from "@/lib/store";

const OFFLINE_KEY = "azanusa-schedule-cache";

interface OfflineCache {
  [regionDate: string]: PrayerSchedule;
}

function cacheKey(code: string, date: string): string {
  return `${code}|${date}`;
}

function readOffline(code: string, date: string): PrayerSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "{}") as OfflineCache;
    const hit = all[cacheKey(code, date)];
    if (!hit) return null;
    // cache offline hanya dipakai maksimal 36 jam
    if (Date.now() - Date.parse(hit.syncedAt) > 36 * 3_600_000) return null;
    return hit;
  } catch {
    return null;
  }
}

function writeOffline(s: PrayerSchedule) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "{}") as OfflineCache;
    // simpan maksimal 8 entri terakhir
    const entries = Object.entries(all);
    if (entries.length >= 8) {
      entries.sort((a, b) => Date.parse(a[1].syncedAt) - Date.parse(b[1].syncedAt));
      for (let i = 0; i < entries.length - 7; i++) delete all[entries[i][0]];
    }
    all[cacheKey(s.region.code, s.date)] = s;
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(all));
  } catch {
    // abaikan
  }
}

interface ScheduleState {
  schedule: PrayerSchedule | null;
  tomorrow: PrayerSchedule | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}

/**
 * Mengambil jadwal salat hari ini + besok untuk wilayah & sumber aktif.
 * Memiliki fallback cache localStorage agar tetap tampil saat offline.
 */
export function useSchedule(): ScheduleState {
  const location = useAppStore((s) => s.location);
  const dataSource = useAppStore((s) => s.dataSource);
  const [state, setState] = useState<ScheduleState>({
    schedule: null,
    tomorrow: null,
    loading: false,
    error: null,
    fromCache: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const code = location?.code ?? null;
  const tz = location?.tz ?? "Asia/Jakarta";

  const fetchAll = useCallback(async () => {
    if (!code) {
      setState({ schedule: null, tomorrow: null, loading: false, error: null, fromCache: false });
      return;
    }
    const today = dateStrInTz(new Date(), tz);
    const tomorrow = addDaysISO(today, 1);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState((s) => ({ ...s, loading: true, error: null }));
    const sumberParam =
      dataSource === "auto" ? "auto" : dataSource; // auto|kemenag|mirror|calc
    try {
      const [resToday, resTomorrow] = await Promise.all([
        fetch(`/api/prayer-times?code=${code}&date=${today}&sumber=${sumberParam}`, { signal: ac.signal }),
        fetch(`/api/prayer-times?code=${code}&date=${tomorrow}&sumber=${sumberParam}`, { signal: ac.signal }),
      ]);
      const jToday = await resToday.json();
      const jTomorrow = await resTomorrow.json();
      if (!resToday.ok || !jToday.ok) {
        // fallback offline
        const offToday = readOffline(code, today);
        const offTomorrow = readOffline(code, tomorrow);
        if (offToday) {
          setState({ schedule: offToday, tomorrow: offTomorrow, loading: false, error: null, fromCache: true });
          return;
        }
        throw new Error(jToday?.error ?? `HTTP ${resToday.status}`);
      }
      const sched = jToday.schedule as PrayerSchedule;
      const schedTomorrow =
        resTomorrow.ok && jTomorrow.ok ? (jTomorrow.schedule as PrayerSchedule) : null;
      writeOffline(sched);
      if (schedTomorrow) writeOffline(schedTomorrow);
      setState({ schedule: sched, tomorrow: schedTomorrow, loading: false, error: null, fromCache: false });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const offToday = readOffline(code, today);
      const offTomorrow = readOffline(code, tomorrow);
      if (offToday) {
        setState({ schedule: offToday, tomorrow: offTomorrow, loading: false, error: null, fromCache: true });
        return;
      }
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, [code, tz, dataSource]);

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  // Perbarui otomatis saat hari berganti (di zona waktu wilayah)
  useEffect(() => {
    const id = setInterval(() => {
      const today = dateStrInTz(new Date(), tz);
      if (state.schedule && state.schedule.date !== today) fetchAll();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchAll, tz, state.schedule]);

  return state;
}
