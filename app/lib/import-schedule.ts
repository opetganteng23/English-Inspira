// Impor jadwal coaching dari Excel/CSV (penentuan kelas/jadwal massal). Bagian murni: memetakan baris tabel
// ke baris tervalidasi; pengelompokan jadi slot, pencarian coach/peserta, dan penulisan DB ada di route (butuh DB).
// Satu baris = satu (peserta, sesi). Baris dengan coach + tanggal + jam mulai yang sama digabung jadi satu slot
// (satu sesi bisa diisi banyak peserta sekaligus, sesuai kapasitas).
const ALIASES: Record<string, string[]> = {
  coach: ["coach", "coach email", "pengajar", "trainer"],
  date: ["date", "tanggal", "session date"],
  time: ["time", "start time", "jam", "jam mulai", "waktu"],
  duration: ["duration", "duration (min)", "duration_min", "durasi", "durasi (menit)"],
  mode: ["mode"],
  location: ["location", "room", "meeting url", "meeting link", "link", "lokasi", "ruangan"],
  capacity: ["capacity", "kapasitas", "seats"],
  level: ["level", "target level"],
  title: ["title", "class", "class name", "topic", "kelas"],
  participant: ["participant", "participant email", "email", "peserta"],
};
const pick = (head: Map<string, number>, k: keyof typeof ALIASES) => ALIASES[k].map((a) => head.get(a)).find((x) => x !== undefined);

export const SCHEDULE_TEMPLATE_HEADER = ["coach", "date", "time", "duration", "mode", "location", "capacity", "level", "title", "participant"];
export const SCHEDULE_TEMPLATE_EXAMPLE = ["coach.rina@example.com", "2026-11-03", "09:00", "60", "online", "https://meet.google.com/abc-defg-hij", "6", "", "Structure clinic", "participant1@example.com"];

export type ScheduleRow = {
  row: number;
  coachEmail: string;
  startsAt: Date;
  endsAt: Date;
  mode: "online" | "offline";
  location: string;
  capacity?: number;
  level: string;
  title: string;
  participantEmail: string;
  /** Kunci pengelompokan slot: coach + waktu mulai persis. Baris dengan groupKey sama = satu sesi. */
  groupKey: string;
};
export type ScheduleRowResult = { row: number; ok: true; data: ScheduleRow } | { row: number; ok: false; error: string };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function mapScheduleRows(table: string[][]): ScheduleRowResult[] {
  const head = new Map(table[0].map((h, i) => [h.toLowerCase().trim(), i] as const));
  const col = (k: keyof typeof ALIASES) => pick(head, k);
  const need = (["coach", "date", "time", "participant"] as const).filter((k) => col(k) === undefined);
  if (need.length) return [{ row: 1, ok: false, error: `Required columns not found: ${need.join(", ")}` }];

  return table.slice(1).map((r, i) => {
    const row = i + 2, get = (k: keyof typeof ALIASES) => (col(k) !== undefined ? (r[col(k)!] ?? "").trim() : "");
    const coachEmail = get("coach").toLowerCase();
    if (!coachEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coachEmail)) return { row, ok: false as const, error: `Invalid coach email "${get("coach")}"` };
    const participantEmail = get("participant").toLowerCase();
    if (!participantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participantEmail)) return { row, ok: false as const, error: `Invalid participant email "${get("participant")}"` };
    const dm = DATE_RE.exec(get("date"));
    if (!dm) return { row, ok: false as const, error: `Invalid date "${get("date")}" (use YYYY-MM-DD)` };
    const tm = TIME_RE.exec(get("time"));
    if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) return { row, ok: false as const, error: `Invalid time "${get("time")}" (use HH:MM)` };
    const startsAt = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2])));
    if (Number.isNaN(+startsAt)) return { row, ok: false as const, error: `Invalid date/time "${get("date")} ${get("time")}"` };
    const durRaw = get("duration");
    const duration = durRaw ? Number(durRaw) : 60;
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) return { row, ok: false as const, error: `Invalid duration "${durRaw || duration}" (15-240 minutes)` };
    const modeRaw = get("mode").toLowerCase();
    const mode = modeRaw === "offline" ? "offline" as const : modeRaw === "" || modeRaw === "online" ? "online" as const : null;
    if (!mode) return { row, ok: false as const, error: `Unknown mode "${get("mode")}" (online/offline)` };
    const capRaw = get("capacity");
    const capacity = capRaw ? Number(capRaw) : undefined;
    if (capRaw && (!Number.isInteger(capacity) || (capacity as number) < 1 || (capacity as number) > 100)) return { row, ok: false as const, error: `Invalid capacity "${capRaw}" (1-100)` };
    const endsAt = new Date(+startsAt + duration * 60_000);
    return {
      row, ok: true as const,
      data: { row, coachEmail, startsAt, endsAt, mode, location: get("location"), capacity, level: get("level"), title: get("title"), participantEmail, groupKey: `${coachEmail}|${+startsAt}` },
    };
  });
}
