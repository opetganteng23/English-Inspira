import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { createMember, emailSchema } from "./participants";
import type { ImportRow } from "./import-parse";
import { audit } from "./audit";
import { Institution } from "@/models/Institution";
import { connectDB } from "./db";
import { User } from "@/models/User";

export type ImportReport = { created: number; resent: number; failed: { row: number; email: string; reason: string }[] };

// Impor besar (ribuan baris) diproses paralel terbatas agar selesai jauh di bawah batas waktu proxy (120 dtk).
// Aman: kursi diambil atomik di createMember, dan duplikat dalam file sudah disaring sebelum diproses.
// Bila kursi tidak cukup untuk seluruh file, diproses berurutan agar baris paling atas yang mendapat kursi (dapat diprediksi).
const CONCURRENCY = 16;

/** Proses baris impor; baris gagal dilaporkan, bukan menggagalkan seluruh impor. Duplikat dalam file dilewati. */
export async function importMembers(institutionId: Types.ObjectId | string, rows: ImportRow[], actorId: Types.ObjectId | string): Promise<ImportReport> {
  const report: ImportReport = { created: 0, resent: 0, failed: [] };
  const seen = new Set<string>();
  const todo: ImportRow[] = [];
  for (const r of rows) {
    if (!r.email) { report.failed.push({ row: r.row, email: "", reason: "Empty email" }); continue; }
    if (!emailSchema.safeParse(r.email).success) { report.failed.push({ row: r.row, email: r.email, reason: "Invalid email format" }); continue; }
    if (seen.has(r.email)) { report.failed.push({ row: r.row, email: r.email, reason: "Duplicate within the file" }); continue; }
    seen.add(r.email);
    todo.push(r);
  }

  let next = 0, fatal: unknown = null;
  // Setelah kursi habis, baris berikutnya untuk email baru langsung ditolak tanpa query (impor besar tetap cepat);
  // email yang sudah terdaftar tetap diproses karena undangan ulang tidak memakai kursi.
  let full = false, known: Set<string> | null = null;
  async function worker() {
    while (!fatal && next < todo.length) {
      const r = todo[next++];
      if (full) {
        known ??= new Set((await User.find({ email: { $in: todo.slice(next - 1).map((x) => x.email) } }).select("email").lean()).map((u) => u.email));
        if (!known.has(r.email)) { report.failed.push({ row: r.row, email: r.email, reason: "The institution's seats are full" }); continue; }
      }
      try {
        const out = await createMember(institutionId, { email: r.email, name: r.name, givenName: r.givenName, surname: r.surname, phone: r.phone }, actorId);
        if (out.resent) report.resent++; else report.created++;
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) { fatal = e; return; } // institusi tidak ada: hentikan seluruh impor
        if (e instanceof HttpError && e.status === 409 && /seats are full/i.test(e.message)) full = true;
        report.failed.push({ row: r.row, email: r.email, reason: e instanceof HttpError ? e.message : "Processing failed" });
      }
    }
  }
  await connectDB();
  const inst = await Institution.findById(institutionId).select("seats seatsUsed").lean();
  const seatsLeft = inst ? (inst.seats ?? 0) - (inst.seatsUsed ?? 0) : 0;
  const lanes = seatsLeft >= todo.length ? CONCURRENCY : 1;
  await Promise.all(Array.from({ length: Math.min(lanes, todo.length) }, worker));
  if (fatal) throw fatal;
  report.failed.sort((a, b) => a.row - b.row);
  await audit(actorId, "participants.import", String(institutionId), { created: report.created, resent: report.resent, failed: report.failed.length });
  return report;
}
