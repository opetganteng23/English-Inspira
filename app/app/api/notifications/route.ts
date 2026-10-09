import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError } from "@/lib/rbac";
import { Notification } from "@/models/Access";

export const dynamic = "force-dynamic";

/** Notifikasi milik sendiri (30 terbaru) + jumlah belum dibaca. Boleh dibaca oleh semua peran, termasuk yang belum menyetujui data. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await connectDB();
    const [list, unread] = await Promise.all([
      Notification.find({ userId: me._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ userId: me._id, readAt: { $exists: false } }),
    ]);
    return NextResponse.json({
      unread,
      items: list.map((n) => {
        const p = (n.payload ?? {}) as { title?: string; body?: string; href?: string; email?: string };
        return { id: String(n._id), type: n.type, title: p.title ?? (n.type === "erase_request" ? "Data deletion request" : "Notification"), body: p.body ?? (p.email ?? ""), href: p.href ?? (n.type === "erase_request" ? "/admin/participants" : ""), read: !!n.readAt, at: n.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
