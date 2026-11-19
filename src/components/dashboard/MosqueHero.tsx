"use client";

/**
 * MosqueHero — section Hero resmi AZANUSA:
 * gambar masjid menjadi BACKGROUND UTAMA satu section (position: absolute,
 * object-fit: cover), bukan gambar terpisah. Seluruh konten yang diteruskan
 * melalui `children` (lokasi + tanggal di atas, kartu countdown di bawah)
 * menumpuk/overlay di atas gambar. Gradasi atas menyatu dengan header teal,
 * gradasi bawah menjaga keterbacaan kartu dan menghantar halus ke latar dashboard.
 */

import Image from "next/image";
import type { ReactNode } from "react";

export function MosqueHero({ children }: { children: ReactNode }) {
  return (
    <section className="relative w-full overflow-hidden">
      {/*
        Background masjid: absolut menutupi SELURUH area hero,
        sehingga kartu countdown benar-benar berada DI ATAS gambar
        (bukan elemen terpisah setelah gambar).
      */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/assets/azanusa-mosque-bg.png"
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 576px"
          className="object-cover object-[50%_42%]"
        />
        {/* Gradasi atas: menyatu dengan header teal gelap + keterbacaan lokasi/tanggal */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#01322d] via-[#01322d]/55 to-transparent" />
        {/* Gradasi bawah: keterbacaan kartu countdown + transisi halus menuju latar dashboard */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#01423b] via-[#01423b]/60 to-transparent" />
      </div>

      {/* Konten overlay di atas gambar: lokasi/tanggal (atas) → kartu countdown (bawah) */}
      <div className="relative z-10 flex flex-col">{children}</div>
    </section>
  );
}
