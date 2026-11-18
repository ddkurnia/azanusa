/**
 * Kumpulan doa harian pilihan — teks Arab standar yang umum digunakan
 * (sumber: Al-Qur'an & As-Sunnah, konten domain publik keagamaan).
 */

export interface DuaItem {
  id: string;
  judul: string;
  waktu: string;
  arab: string;
  latin: string;
  arti: string;
}

export const DUA_HARIAN: DuaItem[] = [
  {
    id: "sebelum-tidur",
    judul: "Doa Sebelum Tidur",
    waktu: "Malam",
    arab: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
    latin: "Bismika Allahumma amutu wa ahya",
    arti: "Dengan nama-Mu ya Allah, aku mati dan aku hidup.",
  },
  {
    id: "bangun-tidur",
    judul: "Doa Bangun Tidur",
    waktu: "Pagi",
    arab: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    latin: "Alhamdulillahilladzi ahyaana ba'da maa amaathana wa ilaihin nusyuur",
    arti: "Segala puji bagi Allah yang menghidupkan kami setelah mematikan kami, dan kepada-Nya kami dibangkitkan.",
  },
  {
    id: "sebelum-makan",
    judul: "Doa Sebelum Makan",
    waktu: "Harian",
    arab: "بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ",
    latin: "Bismillahi wa 'ala barakatillah",
    arti: "Dengan nama Allah dan atas berkah Allah.",
  },
  {
    id: "setelah-makan",
    judul: "Doa Setelah Makan",
    waktu: "Harian",
    arab: "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ",
    latin: "Alhamdulillahilladzi ath'amanaa wa saqaaanaa wa ja'alanaa muslimiin",
    arti: "Segala puji bagi Allah yang memberi kami makan dan minum serta menjadikan kami muslim.",
  },
  {
    id: "keluar-rumah",
    judul: "Doa Keluar Rumah",
    waktu: "Harian",
    arab: "بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    latin: "Bismillahi tawakkaltu 'alallah, wa laa haula wa laa quwwata illaa billah",
    arti: "Dengan nama Allah aku bertawakal kepada Allah; tiada daya dan kekuatan kecuali dengan pertolongan Allah.",
  },
  {
    id: "masuk-masjid",
    judul: "Doa Masuk Masjid",
    waktu: "Harian",
    arab: "اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
    latin: "Allahummiftah lii abwaaba rahmatik",
    arti: "Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu.",
  },
  {
    id: "keluar-masjid",
    judul: "Doa Keluar Masjid",
    waktu: "Harian",
    arab: "اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",
    latin: "Allahumma innii as'aluka min fadhlik",
    arti: "Ya Allah, sesungguhnya aku memohon kepada-Mu sebagian karunia-Mu.",
  },
  {
    id: "perjalanan",
    judul: "Doa Memulai Perjalanan",
    waktu: "Harian",
    arab: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ",
    latin: "Subhaanal-ladzii sakhkhara lanaa haadzaa wa maa kunnaa lahuu muqriniin, wa innaa ilaa rabbinaa lamunqalibuun",
    arti: "Maha suci Allah yang menundukkan (kendaraan) ini bagi kami, padahal kami tidak mampu menguasainya, dan sesungguhnya hanya kepada Tuhan kami kami akan kembali.",
  },
  {
    id: "sesudah-adzan",
    judul: "Doa Sesudah Azan",
    waktu: "Lima waktu",
    arab: "اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ",
    latin: "Allahumma rabba haadzihid-da'watit-taammah wash-shalaatil-qaa'imah, aati Muhammadan wasiilata wal-fadhiilah, wab'athhu maqaaman mahmuudan alladzii wa'adtah",
    arti: "Ya Allah, Tuhan pemilik seruan yang sempurna dan salat yang ditegakkan, berilah Nabi Muhammad wasilah dan keutamaan, serta bangkitkan beliau ke kedudukan yang terpuji yang telah Engkau janjikan.",
  },
  {
    id: "keberkahan",
    judul: "Doa Memohon Keberkahan",
    waktu: "Harian",
    arab: "اللَّهُمَّ بَارِكْ لَنَا فِي أَمْوَالِنَا وَأَوْلَادِنَا وَأَرْزَاقِنَا",
    latin: "Allahumma baarik lanaa fii amwaalinaa wa awlaadinaa wa arzaaqinaa",
    arti: "Ya Allah, berkahilah untuk kami harta kami, anak cucu kami, dan rezeki kami.",
  },
  {
    id: "pertolongan",
    judul: "Doa Memohon Pertolongan",
    waktu: "Harian",
    arab: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    latin: "Laa ilaaha illaa anta subhaanaka innii kuntu minazh-zhaalimiin",
    arti: "Tiada tuhan selain Engkau, Maha suci Engkau; sesungguhnya aku termasuk orang yang menzalimi diri sendiri.",
  },
  {
    id: "istighfar",
    judul: "Doa Istigfar Harian",
    waktu: "Harian",
    arab: "أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ",
    latin: "Astaghfirullahal-'azhiim wa atuubu ilaih",
    arti: "Aku memohon ampun kepada Allah Yang Maha Agung dan bertaubat kepada-Nya.",
  },
];

export interface ZikirItem {
  id: string;
  arab: string;
  latin: string;
  arti: string;
  target: number;
}

/** Zikir tasbih setelah salat (hitungan standar) */
export const ZIKIR_SETELAH_SALAT: ZikirItem[] = [
  {
    id: "tasbih",
    arab: "سُبْحَانَ اللَّهِ",
    latin: "Subhanallah",
    arti: "Maha suci Allah",
    target: 33,
  },
  {
    id: "tahmid",
    arab: "الْحَمْدُ لِلَّهِ",
    latin: "Alhamdulillah",
    arti: "Segala puji bagi Allah",
    target: 33,
  },
  {
    id: "takbir",
    arab: "اللَّهُ أَكْبَرُ",
    latin: "Allahu Akbar",
    arti: "Allah Maha Besar",
    target: 33,
  },
  {
    id: "tahlil",
    arab: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    latin: "Laa ilaaha illallahu wahdahu laa syariika lah, lahul mulku wa lahul hamdu wa huwa 'alaa kulli syai'in qadiir",
    arti: "Tiada tuhan selain Allah semata, tiada sekutu bagi-Nya; bagi-Nya kerajaan dan puji; dan Dia Maha Kuasa atas segala sesuatu.",
    target: 1,
  },
];
