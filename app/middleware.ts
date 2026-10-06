import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Gerbang kasar berbasis token (Edge). Pengecekan peran/status final tetap di handler via requireRole().
const COOKIE = "epta_session";
const PARTICIPANT = ["/beranda", "/journey", "/tes", "/ruang-tes", "/hasil", "/materi", "/konselor", "/itp", "/sertifikat", "/profil", "/paket", "/keranjang", "/checkout", "/pembayaran", "/riwayat", "/bantuan"];
// Webhook/cron dipanggil server lain tanpa Origin browser; keamanannya lewat signature/secret masing-masing.
const NO_ORIGIN_CHECK = ["/api/midtrans/notification", "/api/cron/"];

const home = (role: string) => (role === "admin" ? "/admin" : role === "inst_admin" ? "/institusi" : "/beranda");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Perlindungan CSRF untuk mutasi API: cookie SameSite=Lax + pemeriksaan Origin/Sec-Fetch-Site.
  if (pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !NO_ORIGIN_CHECK.some((p) => pathname.startsWith(p))) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      let bad = false;
      if (origin) { try { bad = new URL(origin).host !== host; } catch { bad = true; } }
      else if (req.headers.get("sec-fetch-site") === "cross-site") bad = true;
      if (bad) return NextResponse.json({ error: "Permintaan lintas situs ditolak" }, { status: 403 });
    }
    return NextResponse.next();
  }

  let role: string | null = null;
  const token = req.cookies.get(COOKIE)?.value;
  if (token && process.env.JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      role = payload.role as string;
    } catch {}
  }

  if ((pathname === "/masuk" || pathname === "/daftar") && role) return NextResponse.redirect(new URL(home(role), req.url));

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

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
