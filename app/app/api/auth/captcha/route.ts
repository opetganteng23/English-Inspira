import { NextResponse } from "next/server";
import { createChallenge, turnstileKeys } from "@/lib/captcha";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Captcha untuk halaman masuk/daftar: Turnstile bila dikonfigurasi, selain itu gambar bawaan. */
export async function GET(req: Request) {
  try {
    await limit("verifyIp", clientIp(req));
    const ts = turnstileKeys();
    if (ts) return NextResponse.json({ mode: "turnstile", siteKey: ts.site }, { headers: { "Cache-Control": "no-store" } });
    const c = createChallenge();
    return NextResponse.json({ mode: "builtin", token: c.token, image: `data:image/svg+xml;base64,${Buffer.from(c.svg).toString("base64")}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
