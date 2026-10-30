import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { listJobs, startJob } from "@/lib/bg-jobs";

export const dynamic = "force-dynamic";

const view = (j: Awaited<ReturnType<typeof listJobs>>[number]) => ({
  id: String(j._id), kind: j.kind, label: j.label, status: j.status, total: j.total, done: j.done, ai: j.ai, tokensIn: j.tokensIn, tokensOut: j.tokensOut,
  message: j.message ?? null, file: j.fileId ? j.fileName : null, createdAt: j.createdAt, finishedAt: j.finishedAt ?? null,
});

/** Pekerjaan latar terbaru (?test= untuk satu tes). */
export async function GET(req: Request) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const test = new URL(req.url).searchParams.get("test");
    return NextResponse.json({ jobs: (await listJobs({ testId: test && isValidObjectId(test) ? test : undefined })).map(view) });
  } catch (e) {
    return handleError(e);
  }
}

const oid = z.string().regex(/^[0-9a-f]{24}$/);
/** Mulai pekerjaan: laporan Excel/PowerPoint (admin & academic admin) atau narasi AI (admin saja, memakai biaya API). */
export async function POST(req: Request) {
  try {
    const user = await requireRole(ACADEMIC_ROLES);
    const b = z.object({ kind: z.enum(["narratives", "xlsx", "pptx"]), testId: oid, institutionId: oid.optional() }).parse(await req.json());
    if (b.kind === "narratives" && user.role !== "admin") throw new HttpError(403, "Only admins can generate AI narratives");
    const job = await startJob(b.kind, b.testId, user._id, b.institutionId).catch((e) => { throw new HttpError(409, (e as Error).message); });
    await audit(user._id, `job.${b.kind}`, b.testId, { institutionId: b.institutionId ?? null, jobId: String(job._id) });
    return NextResponse.json({ id: String(job._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return handleError(e);
  }
}
