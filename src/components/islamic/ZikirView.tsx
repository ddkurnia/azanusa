"use client";

import { useMemo, useState } from "react";
import { CircleDot, RotateCcw, Vibrate } from "lucide-react";
import { ZIKIR_SETELAH_SALAT } from "@/data/islamic-content";

export function ZikirView() {
  const [idx, setIdx] = useState(0);
  const [counts, setCounts] = useState<number[]>(ZIKIR_SETELAH_SALAT.map(() => 0));
  const [vibrate, setVibrate] = useState(true);
  const item = ZIKIR_SETELAH_SALAT[idx];
  const count = counts[idx];
  const done = count >= item.target;
  const progress = useMemo(() => Math.min(100, (count / item.target) * 100), [count, item.target]);

  const tap = () => {
    if (done) return;
    const next = count + 1;
    setCounts((c) => c.map((v, i) => (i === idx ? next : v)));
    if (vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(next >= item.target ? [80, 40, 80] : 30);
    }
  };

  const reset = () => setCounts((c) => c.map((v, i) => (i === idx ? 0 : v)));

  return (
    <div className="space-y-3">
      <section className="animate-fade-up rounded-2xl bg-gradient-to-br from-teal-deep to-emerald-az p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <CircleDot className="h-9 w-9 text-gold-soft" />
          <div>
            <h2 className="text-lg font-extrabold">Zikir Pilihan</h2>
            <p className="text-xs text-white/75">Tasbih setelah salat — hitungan 33x dan tahlil penutup</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ZIKIR_SETELAH_SALAT.map((z, i) => (
          <button
            key={z.id}
            onClick={() => setIdx(i)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              i === idx ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {z.latin}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="font-arabic text-2xl leading-loose text-teal-deep" dir="rtl" lang="ar">
          {item.arab}
        </p>
        <p className="mt-2 text-sm italic text-muted-foreground">{item.latin}</p>
        <p className="mt-1 text-sm text-foreground">&ldquo;{item.arti}&rdquo;</p>

        <div className="mt-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${done ? "bg-gold" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {count} / {item.target}
            {done ? " — selesai" : ""}
          </p>
        </div>

        <button
          onClick={tap}
          disabled={done}
          className={`mx-auto mt-6 flex h-32 w-32 flex-col items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 ${
            done ? "bg-gold text-teal-deep" : "bg-primary hover:bg-primary/90"
          }`}
          aria-label={`Hitung zikir ${item.latin}`}
        >
          {done ? (
            <span className="px-4 text-sm font-bold leading-tight">Selesai. Lanjut zikir berikutnya</span>
          ) : (
            <>
              <span className="font-num-tabular text-4xl font-extrabold">{count}</span>
              <span className="mt-1 text-[11px] font-semibold opacity-80">Ketuk untuk hitung</span>
            </>
          )}
        </button>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Ulang dari awal
          </button>
          <button
            onClick={() => setVibrate((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
              vibrate ? "border-primary/40 bg-emerald-soft text-primary" : "border-border text-muted-foreground"
            }`}
          >
            <Vibrate className="h-3.5 w-3.5" />
            Getar {vibrate ? "aktif" : "mati"}
          </button>
        </div>
      </section>
    </div>
  );
}
