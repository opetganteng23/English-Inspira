import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// Backup harian DB dibuat oleh script di VPS (bukan oleh aplikasi); aplikasi hanya membaca foldernya untuk ditampilkan di Settings.
const DIR = process.env.BACKUP_DIR || "/home/Inspira/db-backup";
const WARN_HOURS = 30; // jadwal harian + kelonggaran

export async function backupStatus() {
  try {
    const names = (await readdir(DIR)).filter((n) => /^epta-.*\.archive\.gz$/.test(n));
    const files = await Promise.all(names.map(async (n) => { const s = await stat(path.join(DIR, n)); return { name: n, size: s.size, at: s.mtime }; }));
    files.sort((a, b) => +b.at - +a.at);
    const last = files[0] ?? null;
    const ageH = last ? (Date.now() - +last.at) / 3_600_000 : null;
    return { available: true, count: files.length, last, ageHours: ageH, ok: ageH != null && ageH <= WARN_HOURS, files: files.slice(0, 7) };
  } catch {
    return { available: false, count: 0, last: null, ageHours: null, ok: false, files: [] };
  }
}
