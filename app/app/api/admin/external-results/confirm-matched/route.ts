import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { applyExternalResult } from "@/lib/clustering";
import { AUTO_CONFIRM } from "@/lib/name-match";
import { ExternalResult } from "@/models/Cluster";

/** Konfirmasi sekaligus semua hasil yang cocok pasti (email sama atau nama sama persis) dan sudah berskor. */
export async function POST() {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const rows = await ExternalResult.find({ status: "pending", userId: { $exists: true, $ne: null }, matchConfidence: { $gte: AUTO_CONFIRM }, itpScore: { $ne: null } }).limit(1000).lean();
    let done = 0;
    const failed: { name: string; reason: string }[] = [];
    // Satu peserta bisa muncul dua kali dalam satu unggahan: hanya yang pertama dipakai, sisanya dibiarkan untuk ditinjau.
    const seen = new Set<string>();
    for (const r of rows) {
      const uid = String(r.userId);
      if (seen.has(uid)) { failed.push({ name: r.rawName, reason: "Same participant appears more than once" }); continue; }
      seen.add(uid);
      try { await applyExternalResult(r, uid, admin._id); done++; } catch (e) { failed.push({ name: r.rawName, reason: (e as Error).message }); }
    }
    return NextResponse.json({ confirmed: done, failed });
  } catch (e) {
    return handleError(e);
  }
}
