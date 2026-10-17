import type { Types } from "mongoose";
import { connectDB } from "./db";
import { LIVE } from "./course-access";
import { Course, CourseProgress, Unit, UnitProgress } from "@/models/Course";

export type CourseProgressRow = {
  part: string | null; title: string;
  unitsDone: number; unitsTotal: number;
  quizzesTaken: number; quizzesTotal: number; quizAvg: number | null;
  sectionTest: { best: number; passed: boolean; attempts: number } | null; hasSectionTest: boolean;
};

export const PART_NAME: Record<string, string> = { listening_a: "Listening Part A", listening_b: "Listening Part B", listening_c: "Listening Part C", structure: "Structure", written_expression: "Written Expression", reading: "Reading" };

/**
 * Kemajuan course peserta per bagian di levelnya: unit selesai, rata-rata skor quiz unit (terbaik per unit), dan ujian per bagian.
 * Hanya baris yang sudah ada aktivitasnya yang dikembalikan, supaya laporan tidak penuh angka nol.
 */
export async function courseProgressFor(userId: Types.ObjectId | string, levelId: Types.ObjectId | string | null | undefined): Promise<CourseProgressRow[]> {
  if (!levelId) return [];
  await connectDB();
  const courses = await Course.find({ levelId, ...LIVE }).sort({ order: 1, createdAt: 1 }).select("title part sectionTestId").lean();
  if (!courses.length) return [];
  const [units, uprog, cprog] = await Promise.all([
    Unit.find({ courseId: { $in: courses.map((c) => c._id) }, active: true }).select("courseId quizTestId").lean(),
    UnitProgress.find({ userId, courseId: { $in: courses.map((c) => c._id) } }).select("unitId status quizBest").lean(),
    CourseProgress.find({ userId, courseId: { $in: courses.map((c) => c._id) } }).lean(),
  ]);
  const up = new Map(uprog.map((p) => [String(p.unitId), p]));
  const rows: CourseProgressRow[] = [];
  for (const c of courses) {
    const us = units.filter((u) => String(u.courseId) === String(c._id));
    const withQuiz = us.filter((u) => u.quizTestId);
    const taken = withQuiz.map((u) => up.get(String(u._id))?.quizBest).filter((x): x is number => typeof x === "number");
    const cp = cprog.find((p) => String(p.courseId) === String(c._id));
    const done = us.filter((u) => up.get(String(u._id))?.status === "completed").length;
    const active = done > 0 || taken.length > 0 || (cp?.sectionTestAttempts ?? 0) > 0 || uprog.some((p) => String(p.courseId) === String(c._id));
    if (!active) continue;
    rows.push({
      part: c.part ?? null, title: c.title, unitsDone: done, unitsTotal: us.length,
      quizzesTaken: taken.length, quizzesTotal: withQuiz.length, quizAvg: taken.length ? Math.round(taken.reduce((a, b) => a + b, 0) / taken.length) : null,
      sectionTest: cp && (cp.sectionTestAttempts ?? 0) > 0 ? { best: Math.round(cp.sectionTestBest ?? 0), passed: !!cp.sectionTestPassed, attempts: cp.sectionTestAttempts ?? 0 } : null,
      hasSectionTest: !!c.sectionTestId,
    });
  }
  return rows;
}
