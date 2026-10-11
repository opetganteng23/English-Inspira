import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getEquivalence, participantPool } from "@/lib/clustering";
import { importExternal } from "@/lib/external-import";
import { cefrForItp } from "@/lib/score-equivalence";
import { ExternalResult } from "@/models/Cluster";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const sp = new URL(req.url).searchParams;
    const st = sp.get("status");
    const status: "pending" | "confirmed" | "skipped" = st === "confirmed" || st === "skipped" ? st : "pending";
    await connectDB();
    const [rows, counts, insts] = await Promise.all([
      ExternalResult.find({ status }).sort({ createdAt: -1 }).limit(500).lean(),
      ExternalResult.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Institution.find().select("name").sort({ name: 1 }).lean(),
    ]);
    const users = new Map((await User.find({ _id: { $in: rows.flatMap((r) => (r.userId ? [r.userId] : [])) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    return NextResponse.json({
      counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      institutions: insts.map((i) => ({ id: String(i._id), name: i.name })),
      equivalence: await getEquivalence(),
      items: rows.map((r) => {
        const u = r.userId ? users.get(String(r.userId)) : null;
        return {
          id: String(r._id), batchId: r.batchId, source: r.source, rawName: r.rawName, rawEmail: r.rawEmail ?? null, score: r.score ?? null, itpScore: r.itpScore ?? null,
          cefr: r.itpScore != null ? cefrForItp(r.itpScore) : null, fileName: r.fileName ?? null, hasFile: !!r.fileId, status: r.status, matchConfidence: r.matchConfidence,
          user: u ? { id: String(u._id), name: u.name ?? u.email, email: u.email } : null,
          candidates: (r.candidates ?? []).map((c) => ({ id: String(c.userId), name: c.name, email: c.email ?? null, confidence: c.confidence })),
          createdAt: (r as { createdAt?: Date }).createdAt,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Unggah hasil PURE/OCE (CSV, Excel, atau PDF per orang, boleh banyak berkas). Semua masuk antrean `pending` untuk dicocokkan. */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const form = await req.formData();
    const source = String(form.get("source") ?? "");
    if (source !== "pure" && source !== "oce") throw new HttpError(400, "Choose PURE or OCE");
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) throw new HttpError(400, "Choose at least one file");
    if (files.length > 200) throw new HttpError(413, "Maximum 200 files per upload");
    const inst = String(form.get("institutionId") ?? "") || null;
    await connectDB();
    const out = await importExternal(files, source, await participantPool(inst), await getEquivalence(), admin._id);
    await audit(admin._id, "external_result.upload", out.batchId, { source, files: files.length, created: out.created, matched: out.matched });
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
