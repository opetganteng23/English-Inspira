// Pemeriksaan magic bytes: ekstensi/MIME dari klien tidak dipercaya.

export function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  const g = b.subarray(0, 6).toString("latin1");
  if (g === "GIF87a" || g === "GIF89a") return "image/gif";
  return null; // SVG dan lainnya ditolak (SVG bisa memuat script)
}

/** MP3: header ID3 atau frame sync 0xFFEx. */
export function isMp3(b: Buffer): boolean {
  if (b.length < 4) return false;
  if (b.subarray(0, 3).toString("latin1") === "ID3") return true;
  return b[0] === 0xff && (b[1] & 0xe0) === 0xe0;
}
