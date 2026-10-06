import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { Product } from "@/models/Commerce";
import { grantProduct } from "@/lib/entitlements";
import { limit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/orders";

const schema = z.object({ code: z.string().trim().min(3).max(40) });

/** Peserta memasukkan kode institusi: tergabung ke institusi dan mendapat akses paket institusi. */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    await limit("verifyIp", clientIp(req));
    const { code } = schema.parse(await req.json());
    await connectDB();
    const user = await User.findById(me._id);
    if (!user) throw new HttpError(401, "Belum masuk");

    const inst = await Institution.findOne({ code: code.toUpperCase(), active: true });
    if (!inst || (inst.validUntil && inst.validUntil < new Date())) throw new HttpError(404, "Kode institusi tidak ditemukan atau sudah tidak berlaku");
    if (user.institutionId) {
      if (String(user.institutionId) === String(inst._id)) throw new HttpError(409, "Kamu sudah tergabung di institusi ini");
      throw new HttpError(409, "Akunmu sudah terhubung ke institusi lain");
    }
    // Kursi diambil atomik agar tidak melebihi kuota saat banyak orang memakai kode bersamaan.
    const taken = await Institution.findOneAndUpdate({ _id: inst._id, $expr: { $lt: ["$seatsUsed", "$seats"] } }, { $inc: { seatsUsed: 1 } }, { new: true });
    if (!taken) throw new HttpError(409, "Kuota kursi institusi sudah penuh");

    user.institutionId = inst._id;
    await user.save();
    const product = inst.productId ? await Product.findById(inst.productId).lean() : null;
    if (product) await grantProduct(user._id, product, { source: "institution", note: `Institusi ${inst.name}` });
    await audit(user._id, "institution.redeem", String(inst._id));
    return NextResponse.json({ ok: true, institution: inst.name, granted: product?.name ?? null });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Kode tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
