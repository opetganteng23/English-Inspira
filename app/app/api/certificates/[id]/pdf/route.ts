import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { certificatePdf } from "@/lib/pdf";
import { Certificate } from "@/models/Itp";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Dokumen tidak ditemukan");
    await connectDB();
    const c = await Certificate.findById(params.id).lean();
    if (!c || (String(c.userId) !== String(user._id) && user.role !== "admin")) throw new HttpError(404, "Dokumen tidak ditemukan");
    const owner = await User.findById(c.userId).select("name email").lean();
    const d = (c.data ?? {}) as { name?: string; testName?: string; scores?: { listening?: number; structure?: number; reading?: number; total?: number } };
    const origin = process.env.APP_URL ?? new URL(req.url).origin;
    const pdf = await certificatePdf({
      type: c.type, number: c.number, issuedAt: c.issuedAt, name: d.name ?? owner?.name ?? owner?.email ?? "-", verifyUrl: `${origin}/verifikasi/${c.number}`,
      scores: d.scores ?? {}, title: d.testName,
    });
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.number}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
