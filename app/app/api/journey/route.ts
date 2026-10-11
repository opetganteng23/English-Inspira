import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { UnitProgress } from "@/models/Course";
import { Analysis, PlanItem } from "@/models/Learning";
import { Booking } from "@/models/Coaching";
import { ItpRegistration, Certificate } from "@/models/Itp";

export const dynamic = "force-dynamic";

type State = "done" | "current" | "upcoming";

/** English Intelligence Journey: 7 tahap, status dihitung dari data nyata peserta (bukan paket yang dibeli). */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    const uid = me._id;
    const [u, attempts, unitsDone, unitsAny, analysisReady, planDone, planAny, booked, attended, itpReg, itpCert] = await Promise.all([
      User.findById(uid).select("placementAttemptId").lean(),
      Attempt.find({ userId: uid, status: "submitted" }).select("kind scoreEst finishedAt").sort({ finishedAt: 1 }).lean(),
      UnitProgress.countDocuments({ userId: uid, status: "completed" }),
      UnitProgress.countDocuments({ userId: uid }),
      Analysis.countDocuments({ userId: uid, status: "ready" }),
      PlanItem.countDocuments({ userId: uid, status: "done" }),
      PlanItem.countDocuments({ userId: uid }),
      Booking.countDocuments({ userId: uid, active: true }),
      Booking.countDocuments({ userId: uid, status: "present" }),
      ItpRegistration.findOne({ userId: uid, status: { $ne: "cancelled" } }).select("status").lean(),
      Certificate.countDocuments({ userId: uid, type: "itp" }),
    ]);
    const sims = attempts.filter((a) => a.kind === "sim");
    const placed = !!u?.placementAttemptId || attempts.some((a) => a.kind === "placement");
    const scored = attempts.filter((a) => a.scoreEst != null);
    const gain = scored.length >= 2 ? (scored[scored.length - 1].scoreEst ?? 0) - (scored[0].scoreEst ?? 0) : null;

    const raw: { done: boolean; started: boolean; detail: string; href: string; cta: string }[] = [
      { done: placed, started: placed, detail: placed ? "Placement test completed." : "Take the placement test to set your level.", href: placed ? "/results" : "/tests", cta: placed ? "View result" : "Start placement" },
      { done: unitsDone > 0, started: unitsAny > 0, detail: `${unitsDone} unit${unitsDone === 1 ? "" : "s"} completed.`, href: "/learn", cta: unitsAny ? "Continue learning" : "Open courses" },
      { done: analysisReady > 0, started: attempts.length > 0, detail: analysisReady ? `${analysisReady} AI analysis report${analysisReady === 1 ? "" : "s"} ready.` : "Your first analysis appears after a test.", href: "/results", cta: "See analysis" },
      { done: planDone > 0 || attended > 0, started: planAny > 0 || booked > 0, detail: `${planDone} of ${planAny} plan items done · ${attended} coaching session${attended === 1 ? "" : "s"} attended.`, href: "/coaching", cta: booked || planAny ? "Open coaching" : "Book coaching" },
      { done: sims.length > 0, started: sims.length > 0, detail: sims.length ? `${sims.length} simulation${sims.length === 1 ? "" : "s"} taken.` : "Take a full simulation with section timers.", href: "/tests", cta: sims.length ? "Take another" : "Open tests" },
      { done: sims.length >= 2, started: scored.length >= 2, detail: gain != null ? `${gain >= 0 ? "+" : ""}${gain} points since your first result.` : "Needs at least two results to measure progress.", href: "/home#progress", cta: "View progress" },
      { done: itpCert > 0, started: !!itpReg, detail: itpCert ? "Official certificate issued." : itpReg ? `Registration ${itpReg.status}.` : "Register when your simulation score reaches your target.", href: itpCert ? "/certificates" : "/itp", cta: itpCert ? "View certificate" : "Official ITP test" },
    ];
    // Tahap berjalan = tahap pertama yang belum selesai; sisanya "upcoming" kecuali sudah dimulai.
    const firstOpen = raw.findIndex((p) => !p.done);
    const phases = raw.map((p, i) => ({ ...p, state: (p.done ? "done" : i === firstOpen || p.started ? "current" : "upcoming") as State }));
    const completed = phases.filter((p) => p.state === "done").length;
    return NextResponse.json({ phases, completed, total: phases.length });
  } catch (e) {
    return handleError(e);
  }
}
