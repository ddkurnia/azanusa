"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppSettings, PrayerKey, Region } from "@/types";

export const DEFAULT_NOTIFICATIONS: Record<PrayerKey, { mode: "azan" | "short" | "silent" | "off"; beforeMinutes: number }> = {
  subuh: { mode: "azan", beforeMinutes: 10 },
  zuhur: { mode: "azan", beforeMinutes: 10 },
  asar: { mode: "azan", beforeMinutes: 10 },
  magrib: { mode: "azan", beforeMinutes: 10 },
  isya: { mode: "azan", beforeMinutes: 10 },
};

interface AppState extends AppSettings {
  setLocation: (region: Region) => void;
  setDataSource: (v: AppSettings["dataSource"]) => void;
  setNotification: (key: PrayerKey, patch: Partial<AppSettings["notifications"][PrayerKey]>) => void;
  setAllNotifications: (mode: AppSettings["notifications"][PrayerKey]["mode"]) => void;
  setVolume: (v: number) => void;
  setAudioUnlocked: (v: boolean) => void;
  resetAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      location: null,
      dataSource: "auto",
      notifications: DEFAULT_NOTIFICATIONS,
      volume: 0.8,
      audioUnlocked: false,
      setLocation: (region) => set({ location: region }),
      setDataSource: (v) => set({ dataSource: v }),
      setNotification: (key, patch) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: { ...s.notifications[key], ...patch } },
        })),
      setAllNotifications: (mode) =>
        set((s) => ({
          notifications: Object.fromEntries(
            Object.entries(s.notifications).map(([k, v]) => [k, { ...v, mode }])
          ) as AppSettings["notifications"],
        })),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
      setAudioUnlocked: (v) => set({ audioUnlocked: v }),
      resetAll: () =>
        set({
          location: null,
          dataSource: "auto",
          notifications: DEFAULT_NOTIFICATIONS,
          volume: 0.8,
          audioUnlocked: false,
        }),
    }),
    {
      name: "azanusa-settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
