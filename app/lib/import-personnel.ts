import ExcelJS from "exceljs";
import { connectDB } from "./db";
import { placeOf } from "./branches";
import { User } from "@/models/User";

/** Nama kolom yang dikenali (huruf kecil, spasi -> _). Kolom lain diabaikan: NIK dan email pribadi tidak disimpan (email pribadi hanya untuk mencocokkan). */
const COLS = {
  emailOffice: ["email_kantor", "email_kerja", "email_office", "office_email", "email"],
  emailPersonal: ["email_pribadi", "personal_email"],
  gender: ["kelamin", "jenis_kelamin", "gender", "jk"],
  birthPlace: ["tempat_lahir", "birth_place"],
  birthDate: ["tgl_lahir", "tanggal_lahir", "birth_date", "dob"],
  status: ["sts_karyawan", "status_karyawan", "status_pegawai", "employment_status"],
  branch: ["lokasi_kedudukan", "lokasi", "cabang", "unit", "branch", "unit_kerja"],
  jobTitle: ["jabatan", "job_title", "posisi"],
} as const;

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") { const o = v as { text?: string; result?: unknown; richText?: { text: string }[] }; return o.text ?? (o.richText ? o.richText.map((x) => x.text).join("") : String(o.result ?? "")); }
  return String(v);
};
/** Tanggal "31/03/1994", "1994-03-31", angka serial Excel, atau Date. */
export function parseDate(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return isNaN(+v) ? null : v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000));
  const s = text(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) { const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); return isNaN(+d) || d.getUTCDate() !== +m[1] ? null : d; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}
const genderOf = (s: string) => (/^(l|laki|male|m)/i.test(s) ? "L" : /^(p|perempuan|wanita|female|f)/i.test(s) ? "P" : undefined);
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Impor data kepegawaian (Excel HR) ke profil peserta satu institusi, dicocokkan lewat email.
 * Hanya mengisi/menimpa kolom kepegawaian; akun, nilai, dan jadwal tidak disentuh.
 */
export async function importPersonnel(buf: Buffer | ArrayBuffer, institutionId: string, opts: { dryRun?: boolean } = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  // sheet dan baris judul: yang memuat kolom email
  let ws: ExcelJS.Worksheet | undefined, headRow = 0;
  for (const s of wb.worksheets) {
    for (let i = 1; i <= Math.min(10, s.rowCount); i++) {
      const vals = (s.getRow(i).values as ExcelJS.CellValue[]).map(norm);
      if (vals.some((v) => (COLS.emailOffice as readonly string[]).includes(v))) { ws = s; headRow = i; break; }
    }
    if (ws) break;
  }
  if (!ws) throw new Error("No header row with an email column (e.g. email_kantor) was found.");
  const head = (ws.getRow(headRow).values as ExcelJS.CellValue[]).map(norm);
  const col = (names: readonly string[]) => { for (const n of names) { const i = head.indexOf(n); if (i > 0) return i; } return -1; };
  const C = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, col(v)])) as Record<keyof typeof COLS, number>;
  if (C.emailOffice < 0 && C.emailPersonal < 0) throw new Error("No email column found.");

  await connectDB();
  const users = await User.find({ institutionId, role: "participant" }).select("email").lean();
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u._id]));
  const out = { rows: 0, matched: 0, updated: 0, unmatched: [] as string[], badDate: 0, unmappedBranches: new Set<string>(), missing: [] as string[] };
  out.missing = (Object.keys(COLS) as (keyof typeof COLS)[]).filter((k) => C[k] < 0 && k !== "emailPersonal");
  const ops: Parameters<typeof User.bulkWrite>[0] = [];
  const now = new Date();
  for (let i = headRow + 1; i <= ws.rowCount; i++) {
    const r = ws.getRow(i), get = (c: number) => (c > 0 ? r.getCell(c).value : null);
    const office = text(get(C.emailOffice)).trim().toLowerCase(), personal = text(get(C.emailPersonal)).trim().toLowerCase();
    if (!office && !personal) continue;
    out.rows++;
    const id = byEmail.get(office) ?? (personal ? byEmail.get(personal) : undefined);
    if (!id) { out.unmatched.push(office || personal); continue; }
    out.matched++;
    const set: Record<string, unknown> = { personnelImportedAt: now };
    const g = genderOf(text(get(C.gender)).trim()); if (g) set.gender = g;
    const bp = text(get(C.birthPlace)).trim(); if (bp) set.birthPlace = titleCase(bp);
    if (C.birthDate > 0) { const d = parseDate(get(C.birthDate)); if (d) set.birthDate = d; else if (text(get(C.birthDate)).trim()) out.badDate++; }
    const st = text(get(C.status)).trim(); if (st) set.employmentStatus = st.toUpperCase() === "KARYAWAN" ? "Karyawan" : st;
    const jt = text(get(C.jobTitle)).trim(); if (jt) set.jobTitle = titleCase(jt);
    const br = text(get(C.branch)).trim();
    if (br) { const p = placeOf(br)!; set.branch = p.branch; set.city = p.city; set.province = p.province; if (!p.province) out.unmappedBranches.add(p.branch); }
    ops.push({ updateOne: { filter: { _id: id }, update: { $set: set } } });
  }
  if (!opts.dryRun && ops.length) { const r = await User.bulkWrite(ops, { ordered: false }); out.updated = r.modifiedCount; }
  return { ...out, unmatched: out.unmatched.slice(0, 50), unmatchedCount: out.unmatched.length, unmappedBranches: [...out.unmappedBranches] };
}
