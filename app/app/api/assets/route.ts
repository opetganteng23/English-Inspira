import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { sniffImage } from "@/lib/files";
import { Asset } from "@/models/Asset";

const MAX_GENERAL = 400 * 1024; // klien menargetkan <=300 KB
const MAX_SENSITIVE = 500 * 1024; // KTP / pas foto

export async function POST(req: Request) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const form = await req.formData();
    const file = form.get("file");
    const sensitive = form.get("sensitive") === "true";
    if (!(file instanceof File)) throw new HttpError(400, "File wajib diisi");
    // Aset publik (materi/soal) hanya boleh diunggah admin; peserta hanya aset sensitif miliknya.
    if (!sensitive && user.role !== "admin") throw new HttpError(403, "Tidak punya akses");

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > (sensitive ? MAX_SENSITIVE : MAX_GENERAL))
      throw new HttpError(413, "Gambar terlalu besar. Kompres di klien (maks 300 KB)");
    const mime = sniffImage(buf);
    if (!mime) throw new HttpError(415, "Hanya JPEG, PNG, WebP, atau GIF");

    await connectDB();
    const sha256 = createHash("sha256").update(buf).digest("hex");
    if (!sensitive) {
      const dup = await Asset.findOne({ sha256, sensitive: false }).select("_id");
      if (dup) return NextResponse.json({ id: String(dup._id), url: `/api/assets/${dup._id}`, deduped: true });
    }
    const asset = await Asset.create({
      ownerId: user._id,
      mime,
      size: buf.length,
      width: Number(form.get("width")) || undefined,
      height: Number(form.get("height")) || undefined,
      dataBase64: buf.toString("base64"),
      // Dedup hanya untuk aset publik; aset sensitif tidak boleh dibagi antarpengguna.
      sha256: sensitive ? undefined : sha256,
      sensitive,
    });
    return NextResponse.json({ id: String(asset._id), url: `/api/assets/${asset._id}` }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
