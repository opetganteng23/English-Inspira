import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { loadAttempt, advanceSafely } from "@/lib/attempts";

/** Selesaikan section sekarang dan pindah ke berikutnya (tidak bisa kembali). Section terakhir = submit. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    // Bagian yang ingin ditutup peserta. Permintaan ganda (klik dua kali, kirim ulang saat koneksi lambat, bersamaan dengan timer)
    // tidak boleh ikut menutup bagian BERIKUTNYA: bila bagian itu sudah lewat, cukup kembalikan status terbaru.
    const body = (await req.json().catch(() => ({}))) as { fromIdx?: unknown };
    if (typeof body.fromIdx === "number" && (attempt.status !== "in_progress" || attempt.sectionIdx !== body.fromIdx)) {
      return NextResponse.json({ status: attempt.status, sectionIdx: attempt.sectionIdx, duplicate: true });
    }
    const status = await advanceSafely(attempt, test);
    return NextResponse.json({ status });
  } catch (e) {
    return handleError(e);
  }
}
