import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Enkripsi field sensitif (NIK) dengan AES-256-GCM. Format: v1:iv:tag:ciphertext (base64).
function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    const b = Buffer.from(raw, "base64");
    if (b.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY harus 32 byte (base64)");
    return b;
  }
  if (process.env.NODE_ENV === "production") throw new Error("FIELD_ENCRYPTION_KEY wajib diisi di production");
  return createHash("sha256").update(`dev-only:${process.env.JWT_SECRET ?? "x"}`).digest(); // hanya dev
}

export function encryptField(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptField(packed: string) {
  const [v, iv, tag, enc] = packed.split(":");
  if (v !== "v1") throw new Error("Format enkripsi tidak dikenal");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}

export const maskNik = (nik: string) => (nik.length > 4 ? "•".repeat(nik.length - 4) + nik.slice(-4) : nik);
export const maskName = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + "•".repeat(Math.max(2, w.length - 1))).join(" ");
