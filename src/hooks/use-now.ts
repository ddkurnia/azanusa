"use client";

import { useEffect, useState } from "react";

/** Jam berjalan (per detik) untuk hitung mundur & jam wilayah */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
