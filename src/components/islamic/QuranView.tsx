"use client";

/**
 * QuranView — modul Al-Qur'an AZANUSA dengan data nyata (equran.id).
 * Daftar 114 surat + pencarian, detail surat (Arab, latin, terjemahan Indonesia),
 * cache offline per perangkat.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, Search, X } from "lucide-react";
import { fetchSurah, fetchSurahList, type SurahDetail, type SurahMeta } from "@/lib/quran";

export function QuranView() {
  const [list, setList] = useState<SurahMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SurahMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    fetchSurahList(ac.signal)
      .then((data) => {
        setList(data);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.namaLatin.toLowerCase().includes(q) ||
        s.arti.toLowerCase().includes(q) ||
        String(s.nomor) === q
    );
  }, [list, query]);

  if (selected) {
    return (
      <SurahReader
        key={selected.nomor}
        surah={selected}
        onBack={() => setSelected(null)}
        onNavigate={(n) => {
          const next = list?.find((s) => s.nomor === n);
          if (next) setSelected(next);
        }}
      />
    );
  }

  return (
    <div className="space-y-3 text-white">
      <section className="panel-teal rounded-2xl p-3 shadow-md shadow-black/20">
        <h2 className="text-base font-extrabold">Al-Qur&apos;an</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-white/65">
          114 surat, teks Arab, latin, dan terjemahan Indonesia. Sumber data: equran.id —
          tersimpan di perangkat setelah dibuka agar bisa dibaca offline.
        </p>
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari surat… (contoh: Al-Kahf, 18, Rahmat)"
            className="h-10 w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-9 text-sm text-white placeholder:text-white/40 focus:border-gold/60 focus:outline-none"
            aria-label="Cari surat"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/50 hover:text-white"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-200">
          {error} — periksa koneksi internet, lalu coba lagi. Surat yang pernah dibuka tetap
          tersedia offline.
        </div>
      )}

      {loading && !list && (
        <div className="panel-teal-deep space-y-2 rounded-2xl p-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-1 py-2.5">
              <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-10 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {list && (
        <section className="panel-teal-deep overflow-hidden rounded-2xl shadow-md shadow-black/20">
          <ul className="divide-y divide-white/10">
            {filtered.map((s) => (
              <li key={s.nomor}>
                <button
                  onClick={() => setSelected(s)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/60 bg-gold/10 font-num-tabular text-sm font-bold text-gold">
                    {s.nomor}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{s.namaLatin}</span>
                    <span className="block truncate text-[11px] text-white/60">
                      {s.tempatTurun} • {s.jumlahAyat} ayat • {s.arti}
                    </span>
                  </span>
                  <span className="font-arabic shrink-0 text-lg text-gold-soft">{s.nama}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-white/60">
                Tidak ada surat yang cocok dengan &ldquo;{query}&rdquo;.
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function SurahReader({
  surah,
  onBack,
  onNavigate,
}: {
  surah: SurahMeta;
  onBack: () => void;
  onNavigate: (nomor: number) => void;
}) {
  const [detail, setDetail] = useState<SurahDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    fetchSurah(surah.nomor, ac.signal)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [surah.nomor]);

  return (
    <div className="space-y-3 text-white">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="panel-teal rounded-xl p-2 text-white transition hover:brightness-110"
          aria-label="Kembali ke daftar surat"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">
            {surah.nomor}. {surah.namaLatin}
          </p>
          <p className="truncate text-[11px] text-white/60">
            {surah.tempatTurun} • {surah.jumlahAyat} ayat
          </p>
        </div>
        <span className="font-arabic shrink-0 text-xl text-gold">{surah.nama}</span>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-200">
          {error} — periksa koneksi internet. Surat yang pernah dibuka tetap tersedia offline.
        </div>
      )}

      {loading && !detail && (
        <div className="panel-teal-deep space-y-4 rounded-2xl p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-8 animate-pulse rounded bg-white/10" />
              <div className="h-6 w-full animate-pulse rounded bg-white/10" />
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {detail && (
        <>
          <section className="panel-teal rounded-2xl p-4 shadow-md shadow-black/20">
            <p className="text-center font-num-tabular text-sm font-bold text-gold">
              Surat ke-{detail.nomor}
            </p>
            <p className="mt-1 text-center text-xs leading-relaxed text-white/70">{detail.arti}</p>
          </section>

          <section className="panel-teal-deep rounded-2xl p-3 shadow-md shadow-black/20">
            <ul className="space-y-4">
              {detail.ayat.map((a) => (
                <li
                  key={String(a.nomorAyat)}
                  className="border-b border-white/10 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-gold/50 bg-gold/10 px-2 font-num-tabular text-[11px] font-bold text-gold">
                      {a.nomorAyat}
                    </span>
                  </div>
                  <p className="font-arabic mt-2.5 text-right text-[22px] leading-[1.9] text-white">
                    {a.teksArab}
                  </p>
                  <p className="mt-2 text-[13px] italic leading-relaxed text-white/75">
                    {a.teksLatin}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">
                    {a.teksIndonesia}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center justify-between gap-2 pb-1">
            <button
              onClick={() => onNavigate(detail.nomor - 1)}
              disabled={detail.nomor <= 1}
              className="panel-teal inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition hover:brightness-110 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Sebelumnya
            </button>
            <button
              onClick={() => onNavigate(detail.nomor + 1)}
              disabled={detail.nomor >= 114}
              className="panel-teal inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition hover:brightness-110 disabled:opacity-40"
            >
              Berikutnya <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
