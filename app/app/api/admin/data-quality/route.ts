import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";
const LIST = 300;
type P = { id: string; name: string | null; email: string; institution: string | null; detail?: string };
type U = { _id: unknown; name?: string | null; email: string; institutionId?: unknown };

/** Cek kualitas data (Sesi 6.3): masalah yang dulu dicari lewat script, kini terlihat di satu halaman. */
export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const insts = await Institution.find().select("name").lean();
    const instName = new Map(insts.map((i) => [String(i._id), i.name]));
    const person = (u: U, detail?: string): P => ({ id: String(u._id), name: u.name ?? null, email: u.email, institution: u.institutionId ? instName.get(String(u.institutionId)) ?? null : null, detail });
    const qa = (await User.find({ qaTester: true }).select("_id").lean()).map((u) => u._id);

    // Institusi yang sudah impor data personel: peserta yang belum cocok.
    const withHr = await User.distinct("institutionId", { role: "participant", personnelImportedAt: { $exists: true } });
    const [noPersonnel, noName, dupes, lost, stuck] = await Promise.all([
      User.find({ role: "participant", institutionId: { $in: withHr }, personnelImportedAt: { $exists: false }, _id: { $nin: qa } }).select("name email institutionId").sort({ name: 1 }).limit(LIST).lean(),
      User.find({ role: "participant", _id: { $nin: qa }, $or: [{ name: { $exists: false } }, { name: null }, { name: /^\s*$/ }] }).select("name email institutionId").limit(LIST).lean(),
      User.aggregate<{ ids: U[] }>([
        { $match: { role: "participant", name: { $type: "string", $ne: "" }, _id: { $nin: qa } } },
        { $group: { _id: { n: { $toLower: { $trim: { input: "$name" } } }, i: "$institutionId" }, ids: { $push: { _id: "$_id", name: "$name", email: "$email", institutionId: "$institutionId" } }, c: { $sum: 1 } } },
        { $match: { c: { $gt: 1 } } }, { $limit: LIST },
      ]),
      Attempt.find({ status: "submitted", "integrity.isolatedBlanks": { $gt: 0 }, userId: { $nin: qa } }).select("userId testId integrity.isolatedBlanks").limit(LIST).lean(),
      Attempt.find({ status: "in_progress", startedAt: { $lt: new Date(Date.now() - 6 * 3600_000) }, userId: { $nin: qa } }).select("userId testId startedAt").limit(LIST).lean(),
    ]);
    const both = [...lost, ...stuck];
    const users = new Map((await User.find({ _id: { $in: both.map((a) => a.userId) } }).select("name email institutionId").lean()).map((u) => [String(u._id), u]));
    const tests = new Map((await Test.find({ _id: { $in: both.map((a) => a.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const fromAttempt = (a: { userId: unknown; testId: unknown }, d: string) => { const u = users.get(String(a.userId)); return u ? person(u, `${tests.get(String(a.testId)) ?? "Test"} · ${d}`) : null; };
    const wib = (d: Date) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

    return NextResponse.json({
      limit: LIST,
      checks: [
        { key: "personnel", title: "No personnel data", hint: "Participants of an institution that imported HR data, but no HR row matched them. Fix the email in the HR file or the account, then import again (Institution, Personnel data tab).", people: noPersonnel.map((u) => person(u)) },
        { key: "name", title: "Empty name", hint: "Reports show the email instead. Edit the profile to add the name.", people: noName.map((u) => person(u)) },
        { key: "duplicate", title: "Possible duplicate accounts", hint: "Same name in the same institution. Check whether one person has two accounts.", people: dupes.flatMap((d) => d.ids.map((u) => person(u, `${d.ids.length} accounts with this name`))) },
        { key: "lost", title: "Blanks between answers", hint: "Unanswered questions between answered ones: possibly answers lost to a connection problem. Check the trace before deciding on a retake.", people: lost.map((a) => fromAttempt(a, `${a.integrity?.isolatedBlanks} blanks`)).filter(Boolean) },
        { key: "stuck", title: "Tests still open after 6 hours", hint: "Started but never submitted. Terminate (score what was saved) or reset it from the participant profile.", people: stuck.map((a) => fromAttempt(a, `started ${wib(a.startedAt)} WIB`)).filter(Boolean) },
      ],
    });
  } catch (e) {
    return handleError(e);
  }
}
