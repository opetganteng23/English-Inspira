/**
 * Pilih kelas untuk satu peserta: hanya yang masih punya kursi; diutamakan yang paling longgar (relatif terhadap kapasitas)
 * agar kelas-kelas seimbang; bila beberapa kelas sama longgarnya, dipilih acak. Murni (rng bisa disuntik untuk uji).
 */
export function pickClass(classes: { id: string; capacity: number; count: number }[], rng: () => number = Math.random): string | null {
  const open = classes.filter((c) => c.count < c.capacity);
  if (!open.length) return null;
  const fill = (c: (typeof open)[number]) => c.count / c.capacity;
  const best = Math.min(...open.map(fill));
  const tied = open.filter((c) => Math.abs(fill(c) - best) < 1e-9);
  return tied[Math.min(tied.length - 1, Math.floor(rng() * tied.length))].id;
}
