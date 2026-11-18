#!/usr/bin/env python3
"""Generate AZANUSA regions dataset.

Sumber:
- Kode & nama resmi Kemendagri (Kepmendagri 300.2.2-2430/2025) via github.com/cahyadsn/wilayah (SQL)
- Koordinat: Wikidata (utama, data bersumber + tervalidasi komunitas),
  fallback open-admin-data/indonesia-administrative-divisions
Output: src/data/regions.json (38 provinsi, 514 kab/kota, zona waktu WIB/WITA/WIT)
"""
import json, re, sys, math
from statistics import median

TIMEZONE_BY_PROV = {
    '11': 'Asia/Jakarta', '12': 'Asia/Jakarta', '13': 'Asia/Jakarta', '14': 'Asia/Jakarta',
    '15': 'Asia/Jakarta', '16': 'Asia/Jakarta', '17': 'Asia/Jakarta', '18': 'Asia/Jakarta',
    '19': 'Asia/Jakarta', '21': 'Asia/Jakarta', '31': 'Asia/Jakarta', '32': 'Asia/Jakarta',
    '33': 'Asia/Jakarta', '34': 'Asia/Jakarta', '35': 'Asia/Jakarta', '36': 'Asia/Jakarta',
    '61': 'Asia/Jakarta', '62': 'Asia/Jakarta',
    '51': 'Asia/Makassar', '52': 'Asia/Makassar', '53': 'Asia/Makassar',
    '63': 'Asia/Makassar', '64': 'Asia/Makassar', '65': 'Asia/Makassar',
    '71': 'Asia/Makassar', '72': 'Asia/Makassar', '73': 'Asia/Makassar',
    '74': 'Asia/Makassar', '75': 'Asia/Makassar', '76': 'Asia/Makassar',
    '81': 'Asia/Jayapura', '82': 'Asia/Jayapura', '91': 'Asia/Jayapura',
    '92': 'Asia/Jayapura', '93': 'Asia/Jayapura', '94': 'Asia/Jayapura',
    '95': 'Asia/Jayapura', '96': 'Asia/Jayapura',
}

PROVINCE_FIX = {
    'DKI Jakarta': 'DKI Jakarta',
    'DI Yogyakarta': 'DI Yogyakarta',
    'Kep. Bangka Belitung': 'Kepulauan Bangka Belitung',
    'Kep. Riau': 'Kepulauan Riau',
}

# Nama resmi terbaru (Kemendagri 2025) -> variasi nama sumber lain
NAME_ALIASES = {
    'Kabupaten Toba': 'Kabupaten Toba Samosir',
    'Kabupaten Administrasi Kepulauan Seribu': 'Kabupaten Kepulauan Seribu',
    'Kota Administrasi Jakarta Pusat': 'Kota Jakarta Pusat',
    'Kota Administrasi Jakarta Utara': 'Kota Jakarta Utara',
    'Kota Administrasi Jakarta Barat': 'Kota Jakarta Barat',
    'Kota Administrasi Jakarta Selatan': 'Kota Jakarta Selatan',
    'Kota Administrasi Jakarta Timur': 'Kota Jakarta Timur',
    'Kabupaten Mahakam Ulu': 'Kabupaten Mahakam Hulu',
    'Kabupaten Kep. Siau Tagulandang Biaro': 'Kabupaten Siau Tagulandang Biaro',
    'Kabupaten Pasangkayu': 'Kabupaten Mamuju Utara',
    'Kabupaten Kepulauan Tanimbar': 'Kabupaten Maluku Tenggara Barat',
}

# Perbaikan koordinat jika Wikidata & open-admin keduanya tidak tersedia
COORD_OVERRIDES = {}

def norm(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '', s)
    return s

def strip_prefix(name: str) -> str:
    name = name.replace('Kota Administrasi', '').replace('Administrasi', ' ')
    name = re.sub(r'^(Kabupaten|Kab\.?|Kota)\s+', '', name.strip())
    return name.strip()

def parse_sql(path):
    rows = re.findall(r"^\('([0-9.]+)','([^']+)'\)", open(path, encoding='utf-8').read(), re.M)
    provinces, regencies = {}, {}
    for code, name in rows:
        name = name.strip()
        parts = code.split('.')
        if len(parts) == 1:
            provinces[code] = name
        elif len(parts) == 2:
            regencies[code] = {'code': code, 'name': name, 'provinceCode': parts[0]}
    return provinces, regencies

def load_wikidata():
    d = json.load(open('/tmp/wikidata.json', encoding='utf-8'))
    entries = []
    for b in d['results']['bindings']:
        qid = b['item']['value'].split('/')[-1]
        label = b.get('itemLabel', {}).get('value', '')
        prov = b.get('provLabel', {}).get('value', '')
        m = re.match(r'Point\((-?[0-9.]+) (-?[0-9.]+)\)', b['coord']['value'])
        if not m or not label:
            continue
        lng, lat = float(m.group(1)), float(m.group(2))
        entries.append({'qid': qid, 'label': label, 'prov': prov, 'lat': lat, 'lng': lng})
    return entries

# Provinsi Wikidata -> kode provinsi AZANUSA (variasi label)
PROV_KEY_TO_CODE = {}
_PROV_NAME_VARIANTS = {
    '11': ['Aceh'],
    '12': ['Sumatera Utara', 'Sumatra Utara'],
    '13': ['Sumatera Barat', 'Sumatra Barat'],
    '14': ['Riau'],
    '15': ['Jambi'],
    '16': ['Sumatera Selatan', 'Sumatra Selatan'],
    '17': ['Bengkulu'],
    '18': ['Lampung'],
    '19': ['Kepulauan Bangka Belitung', 'Bangka Belitung'],
    '21': ['Kepulauan Riau'],
    '31': ['DKI Jakarta', 'Jakarta'],
    '32': ['Jawa Barat'],
    '33': ['Jawa Tengah'],
    '34': ['DI Yogyakarta', 'Daerah Istimewa Yogyakarta', 'Yogyakarta'],
    '35': ['Jawa Timur'],
    '36': ['Banten'],
    '51': ['Bali'],
    '52': ['Nusa Tenggara Barat'],
    '53': ['Nusa Tenggara Timur'],
    '61': ['Kalimantan Barat'],
    '62': ['Kalimantan Tengah'],
    '63': ['Kalimantan Selatan'],
    '64': ['Kalimantan Timur'],
    '65': ['Kalimantan Utara'],
    '71': ['Sulawesi Utara'],
    '72': ['Sulawesi Tengah'],
    '73': ['Sulawesi Selatan'],
    '74': ['Sulawesi Tenggara'],
    '75': ['Gorontalo'],
    '76': ['Sulawesi Barat'],
    '81': ['Maluku'],
    '82': ['Maluku Utara'],
    '91': ['Papua'],
    '92': ['Papua Barat'],
    '93': ['Papua Selatan'],
    '94': ['Papua Tengah'],
    '95': ['Papua Pegunungan'],
    '96': ['Papua Barat Daya'],
}
for _c, _names in _PROV_NAME_VARIANTS.items():
    for _n in _names:
        PROV_KEY_TO_CODE[norm(_n)] = _c

def wd_prov_code(label: str):
    return PROV_KEY_TO_CODE.get(norm(label))

def build_wikidata_index(entries):
    """Kunci (kode_provinsi, nama) -> entri, plus indeks nama global."""
    idx = {}
    global_idx = {}
    for e in entries:
        pc = wd_prov_code(e['prov'])
        keys = {norm(e['label']), norm(strip_prefix(e['label']))}
        for key in keys:
            if not key:
                continue
            global_idx.setdefault(key, []).append(e)
            if pc:
                idx.setdefault((pc, key), []).append(e)
    return idx, global_idx

def pick_wikidata(idx, global_idx, sql_name, prov_code):
    """Pencocokan berlapis: (provinsi, nama penuh) -> (provinsi, nama tanpa prefiks) -> (nama penuh)."""
    wants_city = sql_name.lower().startswith('kota')
    full_key = norm(NAME_ALIASES.get(sql_name, sql_name))
    stripped_key = norm(strip_prefix(NAME_ALIASES.get(sql_name, sql_name)))

    def choose(hits):
        if not hits:
            return None
        if len(hits) == 1:
            return hits[0]
        # pilih label yang cocok tipe kota/kabupaten bila ada
        for h in hits:
            nl = norm(h['label'])
            if wants_city and 'kota' in nl and 'administrasi' not in nl:
                return h
            if not wants_city and 'kabupaten' in nl:
                return h
        return hits[0]

    if prov_code:
        h = choose(idx.get((prov_code, full_key)))
        if h:
            return h, 'full'
        h = choose(idx.get((prov_code, stripped_key)))
        if h:
            return h, 'stripped'
    h = choose(global_idx.get(full_key))
    if h:
        return h, 'global-full'
    return None

def load_geo_openadmin():
    reg_geo = json.load(open('/tmp/regency.json', encoding='utf-8'))
    return {norm(r['name']['local']): r for r in reg_geo}

def main():
    prov_sql, reg_sql = parse_sql('/tmp/wilayah.sql')
    wd_entries = load_wikidata()
    wd_idx, wd_global = build_wikidata_index(wd_entries)
    geo_open = load_geo_openadmin()

    print(f'SQL: {len(prov_sql)} provinsi, {len(reg_sql)} kab/kota')
    print(f'Wikidata: {len(wd_entries)} entri; open-admin: {len(geo_open)}')

    regencies = []
    wd_hits = oa_hits = 0
    problems = []
    for code, item in sorted(reg_sql.items()):
        pcode = item['provinceCode']
        pname = prov_sql.get(pcode, '?')
        code_plain = code.replace('.', '')

        hit = pick_wikidata(wd_idx, wd_global, item['name'], pcode)
        src = None
        if hit:
            e, mode = hit
            lat, lng = e['lat'], e['lng']
            src = f"wikidata:{e['qid']}{'(stripped)' if mode == 'stripped' else ''}"
            wd_hits += 1
        else:
            alias = NAME_ALIASES.get(item['name'], item['name'])
            g = geo_open.get(norm(alias))
            if g is None:
                problems.append(f"NO SOURCE: {code_plain} {item['name']}")
                continue
            lat, lng = float(g['geo']['lat']), float(g['geo']['lon'])
            src = 'open-admin'
            oa_hits += 1

        if code_plain in COORD_OVERRIDES:
            lat, lng = COORD_OVERRIDES[code_plain]
            src += '+override'

        regencies.append({
            'code': code_plain,
            'name': item['name'],
            'provCode': pcode,
            'prov': PROVINCE_FIX.get(pname, pname),
            'lat': lat, 'lng': lng,
            'tz': TIMEZONE_BY_PROV[pcode],
        })

    provinces = []
    for pcode, pname in sorted(prov_sql.items()):
        provinces.append({
            'code': pcode,
            'name': PROVINCE_FIX.get(pname, pname),
            'tz': TIMEZONE_BY_PROV[pcode],
        })

    print(f'Koordinat dari Wikidata: {wd_hits}, open-admin: {oa_hits}')
    for p in problems:
        print(' MASALAH:', p)
    if problems:
        sys.exit(1)

    assert len(provinces) == 38, f'provinces={len(provinces)}'
    assert len(regencies) == 514, f'regencies={len(regencies)}'
    counts = {}
    for r in regencies:
        counts[r['prov']] = counts.get(r['prov'], 0) + 1
    for k in ['Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya']:
        print(' ', k, '=', counts.get(k, 0))
    assert counts['Papua'] == 9 and counts['Papua Barat'] == 7
    assert counts['Papua Selatan'] == 4 and counts['Papua Tengah'] == 8
    assert counts['Papua Pegunungan'] == 8 and counts['Papua Barat Daya'] == 6

    # Validasi jangkauan koordinat wilayah Indonesia
    for r in regencies:
        if not (-11.5 <= r['lat'] <= 6.5) or not (94.0 <= r['lng'] <= 141.5):
            raise SystemExit(f"KOORDINAT DI LUAR JANGKAUAN: {r['code']} {r['name']} {r['lat']},{r['lng']}")
    # Deteksi outlier jarak terhadap median provinsi (700 km: Natuna ~530 km lolos)
    byprov = {}
    for r in regencies:
        byprov.setdefault(r['provCode'], []).append(r)
    for pcode, rs in byprov.items():
        mlat, mlng = median([r['lat'] for r in rs]), median([r['lng'] for r in rs])
        for r in rs:
            dx = (r['lng'] - mlng) * 111 * math.cos(math.radians(mlat))
            dy = (r['lat'] - mlat) * 111
            dist = math.sqrt(dx * dx + dy * dy)
            if dist > 700:
                raise SystemExit(f"OUTLIER PROVINSI {pcode}: {r['code']} {r['name']} {r['lat']},{r['lng']} (median {mlat:.2f},{mlng:.2f}, jarak {dist:.0f} km)")
    print('Validasi koordinat: OK')

    import os
    os.makedirs('/home/z/my-project/src/data', exist_ok=True)
    out = {'provinces': provinces, 'regencies': regencies}
    with open('/home/z/my-project/src/data/regions.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize('/home/z/my-project/src/data/regions.json')
    print(f'OK -> src/data/regions.json ({size} bytes, {len(provinces)} prov, {len(regencies)} kab/kota)')

if __name__ == '__main__':
    main()
