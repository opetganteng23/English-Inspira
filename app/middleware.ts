import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Gerbang kasar berbasis token (Edge). Pengecekan peran/status final tetap di handler via requireRole().
const COOKIE = "epta_session";
const PARTICIPANT = ["/beranda", "/journey", "/tes", "/ruang-tes", "/hasil", "/konselor", "/itp", "/sertifikat", "/profil", "/paket", "/keranjang", "/checkout", "/riwayat"];

const home = (role: string) => (role === "admin" ? "/admin" : role === "inst_admin" ? "/institusi" : "/beranda");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let role: string | null = null;
  const token = req.cookies.get(COOKIE)?.value;
  if (token && process.env.JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      role = payload.role as string;
    } catch {}
  }

  const isAuthPage = pathname === "/masuk";
  if (isAuthPage && role) return NextResponse.redirect(new URL(home(role), req.url));

  const need =
    pathname.startsWith("/admin") ? ["admin"] :
    pathname.startsWith("/institusi") ? ["inst_admin", "admin"] :
    PARTICIPANT.some((p) => pathname === p || pathname.startsWith(p + "/")) ? ["participant", "admin", "inst_admin"] :
    null;

  if (need) {
    if (!role) return NextResponse.redirect(new URL(`/masuk?next=${encodeURIComponent(pathname)}`, req.url));
    if (!need.includes(role)) return NextResponse.redirect(new URL(home(role), req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
