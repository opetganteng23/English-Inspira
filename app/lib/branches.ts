/**
 * Cabang/unit (nama dari data kepegawaian) -> kota, provinsi, dan koordinat bandara untuk peta.
 * Kunci: nama tanpa awalan "CABANG", "CABANG PEMBANTU", atau "UNIT", huruf besar.
 */
type Place = { city: string; province: string; lat: number; lng: number };
const PLACES: Record<string, Place> = {
  AMBON: { city: "Ambon", province: "Maluku", lat: -3.71, lng: 128.09 },
  BALIKPAPAN: { city: "Balikpapan", province: "Kalimantan Timur", lat: -1.27, lng: 116.89 },
  "BANDA ACEH": { city: "Banda Aceh", province: "Aceh", lat: 5.52, lng: 95.42 },
  BANJARMASIN: { city: "Banjarmasin", province: "Kalimantan Selatan", lat: -3.44, lng: 114.76 },
  DENPASAR: { city: "Denpasar", province: "Bali", lat: -8.75, lng: 115.17 },
  HALIM: { city: "Jakarta (Halim)", province: "DKI Jakarta", lat: -6.27, lng: 106.89 },
  JATSC: { city: "Tangerang (JATSC)", province: "Banten", lat: -6.13, lng: 106.66 },
  KUPANG: { city: "Kupang", province: "Nusa Tenggara Timur", lat: -10.17, lng: 123.67 },
  LOMBOK: { city: "Lombok", province: "Nusa Tenggara Barat", lat: -8.76, lng: 116.28 },
  MANADO: { city: "Manado", province: "Sulawesi Utara", lat: 1.55, lng: 124.93 },
  MATSC: { city: "Makassar (MATSC)", province: "Sulawesi Selatan", lat: -5.06, lng: 119.55 },
  MEDAN: { city: "Medan", province: "Sumatera Utara", lat: 3.64, lng: 98.89 },
  MERAUKE: { city: "Merauke", province: "Papua Selatan", lat: -8.52, lng: 140.42 },
  PALEMBANG: { city: "Palembang", province: "Sumatera Selatan", lat: -2.9, lng: 104.7 },
  PEKANBARU: { city: "Pekanbaru", province: "Riau", lat: 0.46, lng: 101.45 },
  "BANDAR LAMPUNG": { city: "Bandar Lampung", province: "Lampung", lat: -5.24, lng: 105.18 },
  BANYUWANGI: { city: "Banyuwangi", province: "Jawa Timur", lat: -8.31, lng: 114.34 },
  BATAM: { city: "Batam", province: "Kepulauan Riau", lat: 1.12, lng: 104.12 },
  BIAK: { city: "Biak", province: "Papua", lat: -1.19, lng: 136.11 },
  "LABUAN BAJO": { city: "Labuan Bajo", province: "Nusa Tenggara Timur", lat: -8.49, lng: 119.89 },
  PADANG: { city: "Padang", province: "Sumatera Barat", lat: -0.79, lng: 100.28 },
  PALU: { city: "Palu", province: "Sulawesi Tengah", lat: -0.92, lng: 119.91 },
  "PANGKAL PINANG": { city: "Pangkal Pinang", province: "Kepulauan Bangka Belitung", lat: -2.16, lng: 106.14 },
  SAMARINDA: { city: "Samarinda", province: "Kalimantan Timur", lat: -0.37, lng: 117.26 },
  SOLO: { city: "Solo", province: "Jawa Tengah", lat: -7.52, lng: 110.76 },
  PONTIANAK: { city: "Pontianak", province: "Kalimantan Barat", lat: -0.15, lng: 109.4 },
  SEMARANG: { city: "Semarang", province: "Jawa Tengah", lat: -6.97, lng: 110.38 },
  SENTANI: { city: "Jayapura (Sentani)", province: "Papua", lat: -2.58, lng: 140.52 },
  SORONG: { city: "Sorong", province: "Papua Barat Daya", lat: -0.93, lng: 131.12 },
  SURABAYA: { city: "Surabaya", province: "Jawa Timur", lat: -7.38, lng: 112.79 },
  "TANJUNG PINANG": { city: "Tanjung Pinang", province: "Kepulauan Riau", lat: 0.92, lng: 104.53 },
  TARAKAN: { city: "Tarakan", province: "Kalimantan Utara", lat: 3.33, lng: 117.57 },
  YOGYAKARTA: { city: "Yogyakarta", province: "DI Yogyakarta", lat: -7.9, lng: 110.06 },
  KERTAJATI: { city: "Kertajati", province: "Jawa Barat", lat: -6.65, lng: 108.17 },
  "SIBORONG BORONG": { city: "Siborong-borong", province: "Sumatera Utara", lat: 2.26, lng: 98.99 },
};

const keyOf = (raw: string) => raw.toUpperCase().replace(/^(CABANG PEMBANTU|CABANG|UNIT)\s+/, "").trim();
const tidy = (raw: string) => raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(Jatsc|Matsc)\b/g, (w) => w.toUpperCase());

/** Nama tampilan, kota, provinsi, dan koordinat sebuah cabang. Cabang yang belum dipetakan tetap tampil, tanpa titik peta. */
export function placeOf(branch: string | null | undefined) {
  if (!branch) return null;
  const p = PLACES[keyOf(branch)];
  return { branch: tidy(branch.trim()), city: p?.city ?? "", province: p?.province ?? "", lat: p?.lat ?? null, lng: p?.lng ?? null };
}

/** Koordinat untuk nama cabang yang sudah dirapikan (mis. dari database). */
export const coordsOf = (branch: string) => { const p = PLACES[keyOf(branch)]; return p ? { lat: p.lat, lng: p.lng } : null; };
