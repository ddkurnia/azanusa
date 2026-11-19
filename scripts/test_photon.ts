/**
 * Uji jalur Photon (lapis cadangan pencarian masjid) secara lokal.
 * Jalankan: bun scripts/test_photon.ts <lat> <lng> <radius_m>
 */
import {
  PHOTON_BASE,
  PHOTON_TERMS,
  photonBbox,
  photonToMosques,
  type PhotonFeature,
} from "../src/lib/mosques";

async function main() {
  const [latS, lngS, radS] = process.argv.slice(2);
  const lat = Number(latS ?? "0.974");
  const lng = Number(lngS ?? "102.695");
  const radius = Number(radS ?? "3000");
  const bbox = photonBbox(lat, lng, radius);
  console.log(`Uji Photon: lat=${lat} lng=${lng} radius=${radius} bbox=${bbox}`);
  const results = await Promise.all(
    PHOTON_TERMS.map((term) =>
      fetch(`${PHOTON_BASE}?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lng}&bbox=${encodeURIComponent(bbox)}&limit=50`, {
        signal: AbortSignal.timeout(10_000),
      })
        .then((res) => (res.ok ? (res.json() as Promise<{ features?: PhotonFeature[] }>) : null))
        .catch((e) => {
          console.warn(`  term "${term}" gagal: ${e.message}`);
          return null;
        })
    )
  );
  const features = results.flatMap((r) => r?.features ?? []);
  const mosques = photonToMosques(features, lat, lng, 30);
  console.log(`features mentah: ${features.length} → masjid tersaring: ${mosques.length}`);
  for (const m of mosques) console.log(`  ${m.name} — ${m.distanceKm} km (${m.id})`);
  if (mosques.length === 0) {
    console.log("HASIL KOSONG — periksa filter!");
    process.exit(1);
  }
}

main();
