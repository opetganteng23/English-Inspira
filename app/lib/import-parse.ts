import Papa from "papaparse";
import ExcelJS from "exceljs";
import { HttpError } from "./rbac";

export type ImportRow = { row: number; email: string; name?: string; givenName?: string; surname?: string; phone?: string };

// Judul kolom dinormalkan dulu (huruf kecil, _ dan - jadi spasi), jadi "no_hp", "No HP", "no-hp" sama.
// Urutan email = prioritas: kolom email umum, lalu email kantor, lalu email pribadi (dipakai bila yang lebih utama kosong).
const ALIASES: Record<string, string[]> = {
  email: ["email", "e mail", "surel", "alamat email", "email address",
    "email kantor", "office email", "work email", "email dinas", "email perusahaan",
    "email pribadi", "personal email", "private email"],
  name: ["nama", "name", "full name", "fullname", "nama lengkap", "nama pegawai", "nama karyawan", "nama peserta"],
  givenName: ["given name", "givenname", "first name", "nama depan"],
  surname: ["surname", "last name", "family name", "nama belakang"],
  phone: ["telepon", "phone", "hp", "no hp", "nomor hp", "whatsapp", "telp", "no telp", "nomor telepon", "no telepon", "handphone", "mobile", "phone number", "no wa"],
};
const norm = (h: string) => h.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
const pick = (head: Map<string, number>, k: keyof typeof ALIASES) => ALIASES[k].map((a) => head.get(a)).find((x) => x !== undefined);
const pickAll = (head: Map<string, number>, k: keyof typeof ALIASES) => ALIASES[k].map((a) => head.get(a)).filter((x): x is number => x !== undefined);

/** Nilai sel Excel sebagai teks: hyperlink, rich text, dan hasil rumus ikut terbaca. */
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v !== "object") return String(v);
  // Sel Excel bertipe "time" (tanpa tanggal) didecode ke epoch 1899/1900: tampilkan sebagai HH:MM, bukan tanggal itu.
  if (v instanceof Date) return v.getUTCFullYear() <= 1900 ? v.toISOString().slice(11, 16) : v.toISOString().slice(0, 10);
  if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  if ("text" in v && v.text != null) return typeof v.text === "string" ? v.text : cellText(v.text as ExcelJS.CellValue);
  if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
  return "";
}

function sheetTable(ws: ExcelJS.Worksheet): string[][] {
  const table: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rn) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (c, n) => { cells[n - 1] = cellText(c.value).trim(); });
    table[rn - 1] = cells;
  });
  return Array.from(table, (r) => r ?? []);
}

/** Baca CSV atau .xlsx menjadi daftar tabel (satu per sheet). Maks 2 MB. */
async function readTables(file: File): Promise<string[][][]> {
  if (file.size > 2 * 1024 * 1024) throw new HttpError(413, "Maximum 2 MB");
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = (await file.text()).replace(/^﻿/, "");
    const res = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return [res.data.map((r) => r.map((c) => String(c ?? "").trim()))];
  }
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load((await file.arrayBuffer()) as ExcelJS.Buffer); } catch { throw new HttpError(400, "The file is not a valid Excel (.xlsx) file"); }
    if (!wb.worksheets.length) throw new HttpError(400, "The worksheet is empty");
    return wb.worksheets.map(sheetTable);
  }
  throw new HttpError(415, "Use a .csv or .xlsx file");
}

const isBlank = (r: string[]) => r.every((c) => !c);
function checkSize(table: string[][], maxRows: number) {
  if (table.length < 2) throw new HttpError(400, "The file is empty or only contains column headers");
  if (table.length > maxRows + 1) throw new HttpError(413, `Maximum ${maxRows.toLocaleString("en-GB")} rows per import`);
}

/** Tabel pertama (sheet pertama), baris pertama = judul kolom. Dipakai impor soal dan skor. Maks `maxRows` baris data. */
export async function readTable(file: File, maxRows = 2000): Promise<string[][]> {
  const table = (await readTables(file))[0].filter((r) => !isBlank(r));
  checkSize(table, maxRows);
  return table;
}

/**
 * Baca daftar anggota dari CSV atau .xlsx. Sheet dan baris judul dicari otomatis: sheet pertama yang punya kolom email
 * di 10 baris teratas (mis. file berisi sheet rekap lalu sheet "Detail"). Kolom: email wajib; given name + surname atau name;
 * telepon opsional. Maks 2 MB dan 2.000 baris.
 */
export async function parseMembersFile(file: File, maxRows = 2000): Promise<ImportRow[]> {
  const tables = await readTables(file);
  for (const t of tables) {
    for (let h = 0; h < Math.min(10, t.length); h++) {
      const head = new Map((t[h] ?? []).map((c, i) => [norm(c), i] as const).filter(([k]) => k));
      const emails = pickAll(head, "email");
      if (!emails.length) continue;
      const table = [t[h], ...t.slice(h + 1).filter((r) => !isBlank(r))];
      checkSize(table, maxRows);
      const inn = pick(head, "name"), ip = pick(head, "phone"), ig = pick(head, "givenName"), isn = pick(head, "surname");
      const val = (r: string[], i?: number) => (i !== undefined ? r[i] || undefined : undefined);
      return t.slice(h + 1).flatMap((r, i) => isBlank(r) ? [] : [{
        row: h + i + 2,
        email: (emails.map((ie) => (r[ie] ?? "").trim()).find(Boolean) ?? "").toLowerCase(),
        name: val(r, inn), givenName: val(r, ig), surname: val(r, isn), phone: val(r, ip),
      }]);
    }
  }
  throw new HttpError(400, 'Column "email" not found. Put the column titles (for example email, name, phone) in the first rows of a sheet.');
}
