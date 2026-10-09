import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError } from "@/lib/rbac";
import { markAttendance } from "@/lib/coaching";
import { attendanceInput } from "@/lib/coaching-schemas";

/** Catat kehadiran. Idempoten: mengulang atau mengoreksi tidak menggandakan potongan kuota. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["coach", "admin"]);
    const { status } = attendanceInput.parse(await req.json());
    return NextResponse.json({ ok: true, ...(await markAttendance(me, params.id, status)) });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid attendance status" }, { status: 400 });
    return handleError(e);
  }
}
