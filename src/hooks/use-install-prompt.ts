"use client";

import { useCallback, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribeModule(cb: () => void): () => void {
  const onBeforeInstall = (e: Event) => {
    e.preventDefault();
    deferredEvent = e as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferredEvent = null;
    notify();
  };
  listeners.add(cb);
  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

function subscribeDisplayMode(cb: () => void): () => void {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

/** Menangkap peristiwa instalasi PWA (Android Chrome/Edge) */
export function useInstallPrompt() {
  const available = useSyncExternalStore(
    subscribeModule,
    () => Boolean(deferredEvent),
    () => false
  );
  const installed = useSyncExternalStore(
    subscribeDisplayMode,
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false
  );

  const promptInstall = useCallback(async () => {
    const ev = deferredEvent;
    if (!ev) return "unavailable" as const;
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === "accepted") {
      deferredEvent = null;
      notify();
    }
    return choice.outcome;
  }, []);

  return { available, installed, promptInstall };
}
