import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import { User, type Role } from "@/models/User";

export const SESSION_COOKIE = "epta_session";
const MAX_AGE = 60 * 60 * 24 * 7;

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET wajib diisi (min 32 karakter)");
  return new TextEncoder().encode(s);
};

export type Session = { uid: string; role: Role };

export async function createSession(uid: string, role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function destroySession() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: payload.sub as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Ambil user terkini dari DB (status/peran bisa berubah setelah token terbit). */
export async function getCurrentUser() {
  const sess = await verifyToken(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return null;
  await connectDB();
  const user = await User.findById(sess.uid).lean();
  return user && user.status === "active" ? user : null;
}
