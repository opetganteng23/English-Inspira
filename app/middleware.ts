import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Gerbang kasar berbasis token (Edge). Pengecekan peran/status final tetap di handler via requireRole().
const COOKIE = "epta_session";
const PARTICIPANT = ["/home", "/learn", "/coaching", "/upload-result", "/tests", "/test-room", "/results", "/materials", "/counselor", "/itp", "/certificates", "/profile", "/help"];
// Cron dipanggil server lain tanpa Origin browser; keamanannya lewat CRON_SECRET.
const NO_ORIGIN_CHECK = ["/api/cron/"];

// Mode pemeliharaan: yang tetap terbuka untuk semua orang (halaman login admin, aset, cek status, cron).
const MAINT_OPEN_PAGES = ["/admin/login", "/maintenance"];
const MAINT_OPEN_API = ["/api/maintenance", "/api/health", "/api/cron/", "/api/auth/login", "/api/auth/request-otp", "/api/auth/verify-otp", "/api/auth/logout"];
const MAINT_STATIC = /^\/(fonts|brand)\/|^\/(icon|apple-icon)(\.png)?$|\.(png|jpe?g|svg|webp|ico|woff2?|ttf|css|js|txt)$/;
// Status dibaca dari /api/maintenance dan disimpan sebentar di memori proses (produksi 10 detik).
const TTL = process.env.NODE_ENV === "production" ? 10_000 : 0;
let maint = { at: 0, on: false };

async function maintenanceOn(req: NextRequest) {
  if (TTL && Date.now() - maint.at < TTL) return maint.on;
  try {
    // Wajib di server: INTERNAL_URL=http://127.0.0.1:<port>. Lewat domain publik dari server sendiri bisa lambat/gagal.
    const base = process.env.INTERNAL_URL || req.nextUrl.origin;
    const r = await fetch(`${base}/api/maintenance`, { cache: "no-store", headers: { "x-maint-check": "1" }, signal: AbortSignal.timeout(2000) });
    maint = { at: Date.now(), on: !!(await r.json()).on };
  } catch {
    maint = { at: Date.now(), on: maint.on }; // gagal cek: pakai status terakhir
  }
  return maint.on;
}

const home = (role: string) => (role === "admin" ? "/admin" : role === "inst_admin" ? "/institution" : role === "coach" ? "/coach" : "/home");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  let role: string | null = null;
  const token = req.cookies.get(COOKIE)?.value;
  if (token && process.env.JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      role = payload.role as string;
    } catch {}
  }

  // Mode pemeliharaan: hanya admin yang bisa memakai aplikasi; lainnya melihat halaman pemeliharaan.
  const open = MAINT_STATIC.test(pathname) || (isApi ? MAINT_OPEN_API.some((p) => pathname === p || pathname.startsWith(p)) : MAINT_OPEN_PAGES.includes(pathname));
  if (role !== "admin" && !open && (await maintenanceOn(req))) {
    if (isApi) return NextResponse.json({ error: "The site is under maintenance. Please try again later.", maintenance: true }, { status: 503 });
    // Halaman admin tanpa sesi admin: arahkan ke login admin, bukan halaman pemeliharaan.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return NextResponse.redirect(new URL("/admin/login", req.url));
    return NextResponse.rewrite(new URL("/maintenance", req.url));
  }

  // Perlindungan CSRF untuk mutasi API: cookie SameSite=Lax + pemeriksaan Origin/Sec-Fetch-Site.
  if (isApi) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !NO_ORIGIN_CHECK.some((p) => pathname.startsWith(p))) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      let bad = false;
      if (origin) { try { bad = new URL(origin).host !== host; } catch { bad = true; } }
      else if (req.headers.get("sec-fetch-site") === "cross-site") bad = true;
      if (bad) return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if ((pathname === "/sign-in" || pathname === "/register") && role) return NextResponse.redirect(new URL(home(role), req.url));
  if (pathname === "/admin/login") return role === "admin" ? NextResponse.redirect(new URL("/admin", req.url)) : NextResponse.next();
  if (pathname === "/maintenance" && !(await maintenanceOn(req))) return NextResponse.redirect(new URL("/", req.url));

  const need =
    pathname.startsWith("/admin") ? ["admin"] :
    pathname.startsWith("/institution") ? ["inst_admin", "admin"] :
    pathname === "/coach" || pathname.startsWith("/coach/") ? ["coach", "admin"] :
    pathname === "/consent" ? ["participant", "coach", "inst_admin", "admin"] :
    PARTICIPANT.some((p) => pathname === p || pathname.startsWith(p + "/")) ? ["participant", "admin"] :
    null;

  if (need) {
    if (!role) return NextResponse.redirect(new URL(pathname.startsWith("/admin") ? "/admin/login" : `/sign-in?next=${encodeURIComponent(pathname)}`, req.url));
    if (!need.includes(role)) return NextResponse.redirect(new URL(home(role), req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
