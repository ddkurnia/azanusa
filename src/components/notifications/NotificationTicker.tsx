"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/hooks/use-now";
import { useSchedule } from "@/hooks/use-schedule";
import { useNotificationPermission } from "@/hooks/use-notifications";
import { useAppStore } from "@/lib/store";
import { checkAndNotify, pruneFired } from "@/lib/notifications/scheduler";

/**
 * Mesin pengingat yang berjalan selama aplikasi terbuka.
 * Memeriksa jadwal setiap detik dengan debounce internal 15 detik.
 */
export function NotificationTicker() {
  const now = useNow(1000);
  const { schedule, tomorrow } = useSchedule();
  const permission = useNotificationPermission();
  const notifications = useAppStore((s) => s.notifications);
  const lastTick = useRef(0);

  useEffect(() => {
    if (permission !== "granted" || !schedule) return;
    const t = now.getTime();
    if (t - lastTick.current < 15_000) return;
    lastTick.current = t;
    pruneFired(schedule.date);
    void checkAndNotify(schedule, tomorrow, notifications, now);
  }, [now, permission, schedule, tomorrow]);

  return null;
}
