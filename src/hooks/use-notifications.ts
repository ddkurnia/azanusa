"use client";

import { useCallback, useSyncExternalStore } from "react";

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

function subscribePermission(cb: () => void): () => void {
  if (!("Notification" in window)) return () => {};
  let status: PermissionStatus | null = null;
  let cancelled = false;
  try {
    void navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        status.addEventListener("change", cb);
      })
      .catch(() => {});
  } catch {
    // browser tanpa Permissions API — cukup Notification.permission statis
  }
  return () => {
    cancelled = true;
    status?.removeEventListener("change", cb);
  };
}

function getSnapshot(): PermissionState {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

/** Status izin notifikasi (reaktif terhadap perubahan izin) */
export function useNotificationPermission(): PermissionState {
  return useSyncExternalStore(subscribePermission, getSnapshot, () => "default" as PermissionState);
}

export function useNotifications() {
  const permission = useNotificationPermission();

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!("Notification" in window)) return "unsupported";
    const result = await Notification.requestPermission();
    return result as PermissionState;
  }, []);

  return { permission, requestPermission };
}
