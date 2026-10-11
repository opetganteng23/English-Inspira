import bcryptjs from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long");

type Impl = { hash(p: string, cost: number): Promise<string>; compare(p: string, h: string): Promise<boolean> };

/**
 * bcrypt native berjalan di threadpool libuv sehingga ratusan login serentak tidak memblokir proses Node (event loop).
 * Format hash sama dengan bcryptjs, jadi hash lama tetap valid. Bila paket native gagal terpasang di server,
 * jatuh ke bcryptjs (benar tetapi memblokir saat banyak login serentak).
 */
let impl: Promise<Impl> | null = null;
function load(): Promise<Impl> {
  return (impl ??= import("bcrypt")
    .then((m) => (m.default ?? m) as unknown as Impl)
    .catch(() => {
      console.warn("[password] bcrypt native tidak tersedia, memakai bcryptjs (lebih lambat saat banyak login serentak)");
      return bcryptjs as unknown as Impl;
    }));
}

export const hashPassword = async (p: string) => (await load()).hash(p, 12);
// Hash tiruan agar waktu respons sama saat akun/password tidak ada (tidak membocorkan keberadaan akun).
const DUMMY = "$2b$12$EfA3q9uK2Nco4gSYsWx3AOzUS6YgKTVjSemEtRJWRsGx0AxalBwla";
export const checkPassword = async (p: string, hash?: string | null) => (await (await load()).compare(p, hash || DUMMY)) && !!hash;
