#!/usr/bin/env python3
"""
Persiapan aset resmi AZANUSA dari file unggahan pengguna.

1. Menyalin aset resmi apa adanya ke public/assets/:
   - azanusa-logo.png          (logo horizontal transparan — MASTER, tidak diubah)
   - azanusa-mosque-bg.png     (background masjid senja)
   - azanusa-reference-ui.png  (gambar referensi UI mockup)
   - azanusa-app-icon.png      (ikon aplikasi persegi)
2. Membuat azanusa-logo-mark.png: HANYA potongan simbol emas (kubah+lengkung)
   dari logo asli dengan latar checkerboard dipetakan ke transparansi asli.
   - Bentuk, proporsi, dan warna simbol tidak diubah (ekstraksi piksel asli).
   - Dipakai di header & splash pada latar teal gelap (subtitle hitam logo
     tidak terbaca di latar gelap, sesuai mockup kata digunakan sebagai teks).
3. Membuat ulang ikon PWA dari azanusa-app-icon.png (192/512/maskable/apple/favicon).
"""
from PIL import Image
import os

UP = "/home/z/my-project/upload"
ASSETS = "/home/z/my-project/public/assets"
ICONS = "/home/z/my-project/public/icons"
os.makedirs(ASSETS, exist_ok=True)

SRC_LOGO = os.path.join(UP, "file_00000000792c8207afc5264c7f78447e.png")
SRC_MOSQUE = os.path.join(UP, "file_000000005be08207af6b53ff4c76d8dd.png")
SRC_ICON = os.path.join(UP, "file_0000000016c48207bf46decf8484d7aa.png")
SRC_REF = os.path.join(UP, "file_00000000a2448211aa77d2f03f2697ab.png")

# 1) Salin aset resmi apa adanya
for src, name in [
    (SRC_LOGO, "azanusa-logo.png"),
    (SRC_MOSQUE, "azanusa-mosque-bg.png"),
    (SRC_ICON, "azanusa-app-icon.png"),
    (SRC_REF, "azanusa-reference-ui.png"),
]:
    Image.open(src).save(os.path.join(ASSETS, name))
    print("OK salin", name)

# 2) Ekstrak simbol emas dengan transparansi asli
logo = Image.open(SRC_LOGO).convert("RGB")
w, h = logo.size
# garis pemisah emas berada di x≈544-593 (terpisah dari simbol) -> simbol di kiri x<544
mark = logo.crop((0, 0, 544, h)).convert("RGBA")
px = mark.load()
W, H = mark.size
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        light = (r + g + b) / 3
        # latar checkerboard: netral terang (234-255) -> transparan
        if (mx - mn) < 10 and light > 222:
            px[x, y] = (r, g, b, 0)
        elif (mx - mn) < 18 and light > 236:
            px[x, y] = (r, g, b, 0)
# potong margin transparan agar proporsi pas
bbox = mark.getbbox()
mark = mark.crop(bbox)
mark.save(os.path.join(ASSETS, "azanusa-logo-mark.png"))
print("OK azanusa-logo-mark.png", mark.size)

# 3) Ikon PWA dari ikon aplikasi resmi
icon = Image.open(SRC_ICON).convert("RGB")
def save_icon(size, name, maskable=False):
    if maskable:
        # konten aman untuk crop lingkaran Android: ikon penuh (latar ikon sendiri)
        out = icon.resize((size, size), Image.LANCZOS)
    else:
        out = icon.resize((size, size), Image.LANCZOS)
    out.save(os.path.join(ICONS, name))
    print("OK ikon", name)

save_icon(192, "icon-192.png")
save_icon(512, "icon-512.png")
save_icon(512, "maskable-512.png", maskable=True)
save_icon(180, "apple-touch-icon.png")
save_icon(48, "favicon-48.png")

# Pratinjau verifikasi: mark di atas teal gelap (untuk pemeriksaan visual)
prev = Image.new("RGBA", (mark.width + 80, mark.height + 80), (0, 61, 56, 255))
prev.paste(mark, (40, 40), mark)
prev.convert("RGB").save("/tmp/mark-preview.png")
print("OK pratinjau /tmp/mark-preview.png")
