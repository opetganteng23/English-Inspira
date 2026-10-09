import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { createMember, emailSchema } from "./participants";
import type { ImportRow } from "./import-parse";
import { audit } from "./audit";

export type ImportReport = { created: number; resent: number; failed: { row: number; email: string; reason: string }[] };

/** Proses baris impor satu per satu; baris gagal dilaporkan, bukan menggagalkan seluruh impor. Duplikat dalam file dilewati. */
export async function importMembers(institutionId: Types.ObjectId | string, rows: ImportRow[], actorId: Types.ObjectId | string): Promise<ImportReport> {
  const report: ImportReport = { created: 0, resent: 0, failed: [] };
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.email) { report.failed.push({ row: r.row, email: "", reason: "Empty email" }); continue; }
    if (!emailSchema.safeParse(r.email).success) { report.failed.push({ row: r.row, email: r.email, reason: "Invalid email format" }); continue; }
    if (seen.has(r.email)) { report.failed.push({ row: r.row, email: r.email, reason: "Duplicate within the file" }); continue; }
    seen.add(r.email);
    try {
      const out = await createMember(institutionId, { email: r.email, name: r.name, phone: r.phone }, actorId);
      if (out.resent) report.resent++; else report.created++;
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) throw e; // institusi tidak ada: hentikan seluruh impor
      report.failed.push({ row: r.row, email: r.email, reason: e instanceof HttpError ? e.message : "Processing failed" });
    }
  }
  await audit(actorId, "participants.import", String(institutionId), { created: report.created, resent: report.resent, failed: report.failed.length });
  return report;
}
