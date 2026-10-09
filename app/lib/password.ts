import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long");
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
// Hash tiruan agar waktu respons sama saat akun/password tidak ada (tidak membocorkan keberadaan akun).
const DUMMY = "$2b$12$EfA3q9uK2Nco4gSYsWx3AOzUS6YgKTVjSemEtRJWRsGx0AxalBwla";
export const checkPassword = async (p: string, hash?: string | null) => (await bcrypt.compare(p, hash || DUMMY)) && !!hash;
