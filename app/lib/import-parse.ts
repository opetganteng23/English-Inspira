import Papa from "papaparse";
import ExcelJS from "exceljs";
import { HttpError } from "./rbac";

export type ImportRow = { row: number; email: string; name?: string; phone?: string };

const ALIASES: Record<string, string[]> = {
  email: ["email", "e-mail", "surel"],
  name: ["nama", "name", "full name", "fullname"],
  phone: ["telepon", "phone", "hp", "no hp", "nomor hp", "whatsapp", "telp"],
};
const pick = (head: Map<string, number>, k: keyof typeof ALIASES) => ALIASES[k].map((a) => head.get(a)).find((x) => x !== undefined);

/** Baca CSV atau .xlsx menjadi tabel string (baris pertama = judul kolom). Maks 2 MB dan `maxRows` baris data. */
export async function readTable(file: File, maxRows = 2000): Promise<string[][]> {
  if (file.size > 2 * 1024 * 1024) throw new HttpError(413, "Maximum 2 MB");
  const name = file.name.toLowerCase();
  let table: string[][];
  if (name.endsWith(".csv")) {
    const text = (await file.text()).replace(/^﻿/, "");
    const res = Papa.parse<string[]>(text, { skipEmptyLines: true });
    table = res.data.map((r) => r.map((c) => String(c ?? "").trim()));
  } else if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load((await file.arrayBuffer()) as ExcelJS.Buffer); } catch { throw new HttpError(400, "The file is not a valid Excel (.xlsx) file"); }
    const ws = wb.worksheets[0];
    if (!ws) throw new HttpError(400, "The worksheet is empty");
    table = [];
    ws.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, n) => { const v = c.value; cells[n - 1] = String(typeof v === "object" && v && "text" in v ? (v as { text: string }).text : v ?? "").trim(); });
      table.push(cells);
    });
  } else throw new HttpError(415, "Use a .csv or .xlsx file");
  if (table.length < 2) throw new HttpError(400, "The file is empty or only contains column headers");
  if (table.length > maxRows + 1) throw new HttpError(413, `Maximum ${maxRows.toLocaleString("en-GB")} rows per import`);
  return table;
}

/** Baca CSV atau .xlsx (kolom: email wajib; nama, telepon opsional). Maks 2 MB dan 2.000 baris. */
export async function parseMembersFile(file: File): Promise<ImportRow[]> {
  const table = await readTable(file);
  const head = new Map(table[0].map((h, i) => [h.toLowerCase().trim(), i] as const));
  const ie = pick(head, "email");
  if (ie === undefined) throw new HttpError(400, 'Column "email" not found');
  const inn = pick(head, "name"), ip = pick(head, "phone");
  return table.slice(1).map((r, i) => ({ row: i + 2, email: (r[ie] ?? "").toLowerCase(), name: inn !== undefined ? r[inn] || undefined : undefined, phone: ip !== undefined ? r[ip] || undefined : undefined }));
}
