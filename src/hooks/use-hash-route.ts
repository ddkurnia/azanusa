"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ViewKey =
  | "beranda"
  | "jadwal"
  | "kalender"
  | "kiblat"
  | "doa"
  | "zikir"
  | "masjid"
  | "profil"
  | "pengaturan";

const VALID_VIEWS: ViewKey[] = [
  "beranda",
  "jadwal",
  "kalender",
  "kiblat",
  "doa",
  "zikir",
  "masjid",
  "profil",
  "pengaturan",
];

function parseHash(): ViewKey {
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  return (VALID_VIEWS.includes(h as ViewKey) ? h : "beranda") as ViewKey;
}

function subscribeHash(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** Routing SPA ringan berbasis hash (arsitektur satu rute AZANUSA) */
export function useHashRoute(): [ViewKey, (v: ViewKey) => void] {
  const view = useSyncExternalStore(
    subscribeHash,
    parseHash,
    () => "beranda" as ViewKey
  );

  const navigate = useCallback((v: ViewKey) => {
    if (parseHash() === v) return;
    window.location.hash = `/${v}`;
    window.scrollTo({ top: 0 });
  }, []);

  return [view, navigate];
}
