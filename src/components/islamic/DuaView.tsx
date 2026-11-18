"use client";

import { useState } from "react";
import { BookOpenText, ChevronDown } from "lucide-react";
import { DUA_HARIAN } from "@/data/islamic-content";

export function DuaView() {
  const [openId, setOpenId] = useState<string | null>(DUA_HARIAN[0]?.id ?? null);
  const groups = Array.from(new Set(DUA_HARIAN.map((d) => d.waktu)));

  return (
    <div className="space-y-3">
      <section className="animate-fade-up rounded-2xl bg-gradient-to-br from-teal-deep to-emerald-az p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <BookOpenText className="h-9 w-9 text-gold-soft" />
          <div>
            <h2 className="text-lg font-extrabold">Doa Harian</h2>
            <p className="text-xs text-white/75">Kumpulan doa pilihan dari Al-Qur'an dan As-Sunnah</p>
          </div>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g}</h3>
          {DUA_HARIAN.filter((d) => d.waktu === g).map((d) => {
            const open = openId === d.id;
            return (
              <article key={d.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <button
                  onClick={() => setOpenId(open ? null : d.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  aria-expanded={open}
                >
                  <span className="text-sm font-bold text-teal-deep">{d.judul}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <p className="font-arabic text-right text-xl leading-relaxed text-teal-deep" dir="rtl" lang="ar">
                      {d.arab}
                    </p>
                    <p className="text-sm italic text-muted-foreground">{d.latin}</p>
                    <p className="text-sm leading-relaxed text-foreground">&ldquo;{d.arti}&rdquo;</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
