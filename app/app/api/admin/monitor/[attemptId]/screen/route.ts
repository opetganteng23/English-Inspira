import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { getScreen } from "@/lib/screen-store";

export const dynamic = "force-dynamic";

/** Gambar layar live terakhir (dari memori; tidak disimpan). Admin pusat. */
export async function GET(_req: Request, { params }: { params: { attemptId: string } }) {
  try {
    await requireRole(["admin"]);
    const e = getScreen(params.attemptId);
    if (!e?.img) throw new HttpError(404, "No live screen");
    return new Response(new Uint8Array(e.img), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store, private", "X-Screen-At": String(e.at) } });
  } catch (e) {
    return handleError(e);
  }
}
