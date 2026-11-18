"use client";

/**
 * MosqueHero — background masjid resmi AZANUSA (aset pengguna, tidak diganti).
 * Menyatu dengan dashboard melalui gradasi transparan ke warna teal gelap.
 */

import Image from "next/image";

export function MosqueHero() {
  return (
    <div className="relative h-44 w-full overflow-hidden sm:h-52 md:h-60" aria-hidden>
      <Image
        src="/assets/azanusa-mosque-bg.png"
        alt=""
        fill
        priority
        sizes="(max-width: 640px) 100vw, 576px"
        className="object-cover object-[50%_42%]"
      />
      {/* Gradasi atas: menyatu dengan header teal gelap */}
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#01322d] to-transparent" />
      {/* Gradasi bawah: menyatu dengan latar dashboard */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#01423b] via-[#01423b]/55 to-transparent" />
    </div>
  );
}
