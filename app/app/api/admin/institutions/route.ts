import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { institutionInput } from "@/lib/admin-schemas";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const list = await Institution.find().sort({ createdAt: -1 }).lean();
    const counts = await User.aggregate([{ $match: { institutionId: { $in: list.map((i) => i._id) }, status: { $ne: "disabled" } } }, { $group: { _id: { i: "$institutionId", r: "$role" }, n: { $sum: 1 } } }]);
    const by = (id: unknown, role: string) => counts.find((c) => String(c._id.i) === String(id) && c._id.r === role)?.n ?? 0;
    return NextResponse.json({
      institutions: list.map((i) => ({
        id: String(i._id), name: i.name, code: i.code, seats: i.seats, seatsUsed: i.seatsUsed, contactEmail: i.contactEmail ?? "", batch: i.batch ?? "",
        contractStart: i.contractStart ?? null, contractEnd: i.contractEnd ?? null, status: i.status, coaches: by(i._id, "coach"), admins: by(i._id, "inst_admin"),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = institutionInput.parse(await req.json());
    await connectDB();
    if (await Institution.exists({ code: b.code })) throw new HttpError(409, "Kode institusi sudah dipakai");
    const i = await Institution.create({ ...b, contractStart: b.contractStart ?? undefined, contractEnd: b.contractEnd ?? undefined, contactEmail: b.contactEmail || undefined });
    await audit(admin._id, "institution.create", String(i._id));
    return NextResponse.json({ id: String(i._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
