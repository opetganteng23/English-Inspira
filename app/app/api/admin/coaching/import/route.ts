import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { readTable } from "@/lib/import-parse";
import { mapScheduleRows, SCHEDULE_TEMPLATE_EXAMPLE, SCHEDULE_TEMPLATE_HEADER, type ScheduleRow } from "@/lib/import-schedule";
import { createSlot, bookSlot } from "@/lib/coaching";
import { getLevels } from "@/lib/config";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";
import { CoachSlot } from "@/models/Coaching";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    const csv = [SCHEDULE_TEMPLATE_HEADER, SCHEDULE_TEMPLATE_EXAMPLE].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="coaching-schedule-import-template.csv"' } });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Penentuan kelas/jadwal coaching massal dari Excel/CSV (plotting): satu baris = satu peserta pada satu sesi.
 * Baris dengan coach + waktu mulai yang sama digabung jadi satu slot (sesi), lalu tiap peserta di-booking ke
 * slot itu lewat jalur yang sama persis dengan booking mandiri (kuota, bentrok jadwal, kapasitas tetap dicek).
 * `?dry=1` hanya memvalidasi: coach dan peserta ditemukan, tidak bentrok dengan slot lain milik coach itu.
 * Baris/grup yang gagal dilaporkan dengan alasannya; grup lain tetap diproses.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    const table = await readTable(file, 3000);
    const rows = mapScheduleRows(table);
    if (rows.length === 1 && !rows[0].ok && rows[0].row === 1) throw new HttpError(400, rows[0].error);
    await connectDB();

    const failed: { row: number; reason: string }[] = [];
    const good = rows.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
    for (const r of rows) if (!r.ok) failed.push({ row: r.row, reason: r.error });

    // Kelompokkan baris jadi slot (coach + waktu mulai persis), urut kemunculan pertama.
    const groups = new Map<string, ScheduleRow[]>();
    for (const r of good) { const g = groups.get(r.data.groupKey) ?? []; g.push(r.data); groups.set(r.data.groupKey, g); }

    const levels = await getLevels();
    const coachCache = new Map<string, Awaited<ReturnType<typeof User.findOne>> | null>();
    let slotsCreated = 0, booked = 0;

    for (const [, groupRows] of groups) {
      const first = groupRows[0];
      // Baris peserta duplikat dalam satu grup (email sama) dibooking sekali; sisanya dilaporkan.
      const seen = new Set<string>();
      const toBook: ScheduleRow[] = [];
      for (const gr of groupRows) {
        if (seen.has(gr.participantEmail)) { failed.push({ row: gr.row, reason: "Duplicate participant for this session within the file" }); continue; }
        seen.add(gr.participantEmail); toBook.push(gr);
      }

      if (!coachCache.has(first.coachEmail)) coachCache.set(first.coachEmail, await User.findOne({ email: first.coachEmail, role: "coach" }));
      const coach = coachCache.get(first.coachEmail);
      if (!coach) { for (const gr of groupRows) failed.push({ row: gr.row, reason: `Coach not found: "${first.coachEmail}" (must be an existing coach account)` }); continue; }

      const levelId = first.level ? levels.find((l) => l.name.toLowerCase() === first.level.toLowerCase())?._id : undefined;
      if (first.level && !levelId) { for (const gr of groupRows) failed.push({ row: gr.row, reason: `Unknown level "${first.level}"` }); continue; }

      const capacity = Math.max(toBook.length, ...groupRows.map((gr) => gr.capacity ?? 0).filter(Boolean), 1);
      if (dry) {
        // Pratinjau tanpa menulis: cek bentrok dengan slot aktif coach lain di jam yang sama.
        const clash = await CoachSlot.exists({ coachId: coach._id, status: { $ne: "cancelled" }, startsAt: { $lt: first.endsAt }, endsAt: { $gt: first.startsAt } });
        if (clash) { for (const gr of groupRows) failed.push({ row: gr.row, reason: "Overlaps with another slot this coach already has" }); continue; }
        if (first.startsAt <= new Date()) { for (const gr of groupRows) failed.push({ row: gr.row, reason: "The start time must be in the future" }); continue; }
        slotsCreated++; booked += toBook.length;
        continue;
      }

      let slot;
      try {
        slot = await createSlot(coach, {
          title: first.title || undefined, startsAt: first.startsAt, endsAt: first.endsAt, mode: first.mode,
          meetingUrl: first.mode === "online" ? first.location || undefined : undefined,
          room: first.mode === "offline" ? first.location || undefined : undefined,
          capacity, levelId: levelId ? String(levelId) : undefined,
        });
      } catch (e) {
        for (const gr of groupRows) failed.push({ row: gr.row, reason: e instanceof HttpError ? e.message : "Could not create the session" });
        continue;
      }
      await CoachSlot.updateOne({ _id: slot._id, status: "draft" }, { status: "published" }); // sesi dijadwalkan lewat Excel langsung terbuka untuk dibooking
      slotsCreated++;

      for (const gr of toBook) {
        const p = await User.findOne({ email: gr.participantEmail, role: "participant" }).select("_id role institutionId currentLevelId").lean();
        if (!p) { failed.push({ row: gr.row, reason: `Participant not found: "${gr.participantEmail}"` }); continue; }
        if (String(p.institutionId ?? "") !== String(coach.institutionId)) { failed.push({ row: gr.row, reason: "Participant is not in the same institution as the coach" }); continue; }
        try { await bookSlot(p, String(slot._id)); booked++; }
        catch (e) { failed.push({ row: gr.row, reason: e instanceof HttpError ? e.message : "Booking failed" }); }
      }
    }

    failed.sort((a, b) => a.row - b.row);
    if (!dry) await audit(admin._id, "coaching.schedule_import", file.name, { slots: slotsCreated, booked, failed: failed.length });
    return NextResponse.json({ dry, slots: slotsCreated, booked, failed });
  } catch (e) {
    return handleError(e);
  }
}
