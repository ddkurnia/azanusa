/**
 * Generator identitas visual AZANUSA.
 * Membuat logo SVG orisinal + ikon PWA PNG (sharp).
 * Logo: kubah masjid + bulan sabit + bintang segi delapan (geometri Islami).
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// Palet resmi AZANUSA
const EMERALD = '#0E7A55';
const TEAL_DEEP = '#0C3D36';
const TEAL_MID = '#12503F';
const GOLD = '#D9B45B';
const GOLD_LIGHT = '#EFD9A0';
const WHITE = '#FFFFFF';

function star8(cx, cy, rOuter, rInner, fill, opacity = 1) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" opacity="${opacity}"/>`;
}

function logoSvg({ maskable = false, size = 512 } = {}) {
  // Maskable: konten diberi padding aman ~14% agar aman di-crop lingkaran Android
  const pad = maskable ? 0.86 : 1;
  const cx = 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL_DEEP}"/>
      <stop offset="0.55" stop-color="${TEAL_MID}"/>
      <stop offset="1" stop-color="${EMERALD}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="${maskable ? 0 : 112}" fill="url(#bg)"/>
  <!-- pola geometris islami (bintang 8, samar) -->
  <g transform="translate(${(256 * (1 - pad) + 256 * pad - 256).toFixed(1)}, ${(256 * (1 - pad) + 256 * pad - 256).toFixed(1)}) scale(${pad})">
    ${star8(256, 262, 168, 134, WHITE, 0.10)}
    ${star8(256, 262, 120, 96, WHITE, 0.08)}
    <!-- kubah masjid -->
    <path d="M256 128 C 196 176 168 232 168 296 L 344 296 C 344 232 316 176 256 128 Z" fill="url(#gold)"/>
    <!-- pintu lengkung pada kubah -->
    <path d="M256 214 C 232 240 220 266 220 296 L 292 296 C 292 266 280 240 256 214 Z" fill="${TEAL_DEEP}" opacity="0.9"/>
    <!-- dasar kubah -->
    <rect x="140" y="296" width="232" height="26" rx="10" fill="url(#gold)"/>
    <rect x="158" y="322" width="196" height="22" rx="9" fill="${GOLD}" opacity="0.85"/>
    <!-- finial + bulan sabit -->
    <rect x="250" y="96" width="12" height="40" rx="6" fill="url(#gold)"/>
    <path d="M262 66 A 26 26 0 1 1 236 40 A 20 20 0 1 0 262 66 Z" fill="${GOLD_LIGHT}" transform="translate(0,-2)"/>
    <!-- bintang kecil di sisi bulan sabit -->
    ${star8(296, 52, 16, 7, GOLD_LIGHT, 0.95)}
  </g>
</svg>`;
}

async function makePng(svg, out, size) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(out);
  console.log('OK', out);
}

(async () => {
  const app = logoSvg({ maskable: false });
  const mask = logoSvg({ maskable: true });
  fs.writeFileSync(path.join(OUT, 'logo.svg'), app);
  fs.writeFileSync(path.join(OUT, 'maskable.svg'), mask);
  await makePng(app, path.join(OUT, 'icon-192.png'), 192);
  await makePng(app, path.join(OUT, 'icon-512.png'), 512);
  await makePng(mask, path.join(OUT, 'maskable-512.png'), 512);
  await makePng(app, path.join(OUT, 'apple-touch-icon.png'), 180);
  await makePng(app, path.join(OUT, 'favicon-48.png'), 48);
  console.log('Selesai.');
})();
