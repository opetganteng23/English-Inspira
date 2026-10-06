import type { Types } from "mongoose";
import { connectDB } from "./db";
import { Entitlement, Product, getSetting, type GrantType } from "@/models/Commerce";
import { Attempt } from "@/models/Test";
import { CounselorThread } from "@/models/Counselor";

const notExpired = () => ({
  revokedAt: { $exists: false },
  $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

/** Beri akses dari produk (order, institusi, atau manual). */
export async function grantProduct(
  userId: Types.ObjectId | string,
  product: { _id: Types.ObjectId; entitlements: { kind: GrantType; ref?: string | null; qty?: number | null }[]; validDays?: number | null },
  opts: { source: "order" | "institution" | "manual"; orderId?: Types.ObjectId | string; note?: string }
) {
  return Entitlement.create({
    userId, productId: product._id, orderId: opts.orderId, source: opts.source, note: opts.note,
    grants: product.entitlements.map((g) => ({ kind: g.kind, ref: g.ref ?? undefined, qty: g.qty ?? 1, remaining: g.qty ?? 1 })),
    expiresAt: product.validDays ? new Date(Date.now() + product.validDays * 86_400_000) : undefined,
  });
}

export async function activeEntitlements(userId: Types.ObjectId | string) {
  await connectDB();
  return Entitlement.find({ userId, ...notExpired() }).lean();
}

/** Ambil 1 jatah secara atomik. Mengembalikan id entitlement, atau null bila tidak ada jatah. */
export async function consumeGrant(userId: Types.ObjectId | string, type: GrantType, ref?: string) {
  await connectDB();
  const elem = { kind: type, ...(ref ? { ref } : {}), remaining: { $gt: 0 } };
  const e = await Entitlement.findOneAndUpdate(
    { userId, ...notExpired(), grants: { $elemMatch: elem } },
    { $inc: { "grants.$[g].remaining": -1 } },
    { arrayFilters: [{ "g.kind": type, ...(ref ? { "g.ref": ref } : {}), "g.remaining": { $gt: 0 } }], new: true, sort: { expiresAt: 1 } }
  );
  return e?._id ?? null;
}

export async function refundGrant(entitlementId: Types.ObjectId | string, type: GrantType, ref?: string) {
  await Entitlement.updateOne(
    { _id: entitlementId },
    { $inc: { "grants.$[g].remaining": 1 } },
    { arrayFilters: [{ "g.kind": type, ...(ref ? { "g.ref": ref } : {}) }] }
  );
}

export async function hasMaterials(userId: Types.ObjectId | string) {
  await connectDB();
  return !!(await Entitlement.exists({ userId, ...notExpired(), "grants.kind": "materials" }));
}

export const COUNSELOR_DEFAULTS = { freeMessages: 3 };

/** Akses Konselor AI: entitlement aktif, atau jatah gratis (seumur akun) setelah menyelesaikan free trial. */
export async function counselorAccess(userId: Types.ObjectId | string) {
  await connectDB();
  const cfg = await getSetting("counselor", COUNSELOR_DEFAULTS);
  const ents = await Entitlement.find({ userId, ...notExpired(), "grants.kind": "counselor" }).lean();
  const grants = ents.flatMap((e) => e.grants.filter((g) => g.kind === "counselor").map((g) => ({ qty: g.qty ?? 0, expiresAt: e.expiresAt })));
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const threads = await CounselorThread.find({ userId }).select("messages").lean();
  const userMsgs = threads.flatMap((t) => t.messages.filter((m) => m.role === "user"));

  if (grants.length) {
    const unlimited = grants.some((g) => g.qty === 0);
    const cap = unlimited ? null : Math.max(...grants.map((g) => g.qty));
    const today = userMsgs.filter((m) => m.at && m.at >= startOfDay).length;
    const exp = grants.some((g) => !g.expiresAt) ? null : new Date(Math.max(...grants.map((g) => +g.expiresAt!)));
    const allowed = cap === null || today < cap;
    return {
      allowed, mode: "paid" as const, remaining: cap === null ? null : Math.max(0, cap - today), dailyCap: cap, expiresAt: exp,
      reason: allowed ? null : `Batas ${cap} pesan hari ini tercapai. Lanjut besok.`,
    };
  }
  const hasTrial = !!(await Attempt.exists({ userId, kind: "trial", status: "submitted" }));
  const left = Math.max(0, cfg.freeMessages - userMsgs.length);
  if (hasTrial && left > 0) return { allowed: true, mode: "free" as const, remaining: left, dailyCap: null, expiresAt: null, reason: null };
  return {
    allowed: false, mode: "none" as const, remaining: 0, dailyCap: null, expiresAt: null,
    reason: hasTrial ? "Jatah gratis habis. Beli paket untuk melanjutkan konseling." : `Selesaikan free trial untuk membuka ${cfg.freeMessages} pertanyaan gratis ke Konselor AI.`,
  };
}

/** Ringkasan akses untuk UI (Beranda, Journey, Paket). */
export async function accessSummary(userId: Types.ObjectId | string) {
  const ents = await activeEntitlements(userId);
  const tests: Record<string, number> = {};
  let itp = 0, materials = false;
  for (const e of ents) for (const g of e.grants) {
    if (g.kind === "test" && g.ref) tests[g.ref] = (tests[g.ref] ?? 0) + (g.remaining ?? 0);
    if (g.kind === "itp") itp += g.remaining ?? 0;
    if (g.kind === "materials") materials = true;
  }
  const productIds = ents.map((e) => e.productId).filter((x): x is NonNullable<typeof x> => !!x);
  const products = await Product.find({ _id: { $in: productIds } }).select("slug name kind").lean();
  return { tests, itp, materials, counselor: await counselorAccess(userId), products: products.map((p) => ({ slug: p.slug, name: p.name, kind: p.kind })) };
}
