import type { UserDoc } from "@/models/User";
import type { TestDoc } from "@/models/Test";

/**
 * Siapa boleh memulai tes apa (MTS §11–12). Mengembalikan alasan bila ditolak, untuk ditampilkan di UI.
 * - placement: sekali; ulang hanya bila diizinkan admin/coach (`placementRetakeAllowed`).
 * - sim/practice: setelah placement, dan sesuai level tes (tes tanpa level = semua level).
 * - quiz: hanya dari unit belajar (Fase 4).
 */
export function canStartTest(user: Pick<UserDoc, "role" | "placementAttemptId" | "placementRetakeAllowed" | "currentLevelId">, test: Pick<TestDoc, "kind" | "levelId">): { ok: boolean; reason?: string } {
  if (user.role === "admin") return { ok: true };
  if (user.role !== "participant") return { ok: false, reason: "Hanya peserta yang mengerjakan tes" };
  const done = !!user.placementAttemptId;
  if (test.kind === "placement") return done && !user.placementRetakeAllowed ? { ok: false, reason: "Placement test sudah dikerjakan. Ulang hanya atas izin coach atau admin." } : { ok: true };
  if (!done) return { ok: false, reason: "Kerjakan placement test dulu" };
  if (test.kind === "quiz") return { ok: false, reason: "Kuis dikerjakan dari unit belajar" };
  if (test.levelId && String(test.levelId) !== String(user.currentLevelId)) return { ok: false, reason: "Tes ini untuk level lain" };
  return { ok: true };
}
