import { handleError, HttpError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { getScreen } from "@/lib/screen-store";

export const dynamic = "force-dynamic";

/** Gambar layar live terakhir untuk portal institusi: hanya peserta institusi ini (dari memori; tidak disimpan). */
export async function GET(req: Request, { params }: { params: { attemptId: string } }) {
  try {
    const { inst } = await instContext(req);
    const e = getScreen(params.attemptId);
    if (!e?.img || e.institutionId !== String(inst._id)) throw new HttpError(404, "No live screen");
    return new Response(new Uint8Array(e.img), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store, private", "X-Screen-At": String(e.at) } });
  } catch (e) {
    return handleError(e);
  }
}
