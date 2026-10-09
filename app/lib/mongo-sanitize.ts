// Lapisan pertahanan tambahan terhadap injeksi operator NoSQL (MTS §20). Input utama sudah lewat Zod; ini untuk
// bagian bebas bentuk (z.unknown, disimpan sebagai Mixed). Membuang kunci berawalan "$" atau berisi "." pada kedalaman berapa pun.
const MAX_DEPTH = 12;

export function mongoSanitize<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH) return null as T;
  if (Array.isArray(value)) return value.map((v) => mongoSanitize(v, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith("$") || k.includes(".") || k === "__proto__" || k === "constructor") continue;
      out[k] = mongoSanitize(v, depth + 1);
    }
    return out as T;
  }
  return value;
}
