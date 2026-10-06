import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Asset } from "@/models/Asset";
import { audit } from "@/lib/orders";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) return new Response("Not found", { status: 404 });
  await connectDB();
  const a = await Asset.findById(params.id).lean();
  if (!a) return new Response("Not found", { status: 404 });

  if (a.sensitive) {
    const u = await getCurrentUser();
    const owner = u && a.ownerId && String(a.ownerId) === String(u._id);
    if (!u || (!owner && u.role !== "admin")) return new Response("Forbidden", { status: u ? 403 : 401 });
    if (!owner) await audit(u!._id, "pii.asset_view", params.id); // admin membuka dokumen peserta: dicatat
    return new Response(Buffer.from(a.dataBase64, "base64"), {
      headers: { "Content-Type": a.mime, "Cache-Control": "private, no-store" },
    });
  }

  const etag = `"${a.sha256}"`;
  const headers = { ETag: etag, "Cache-Control": "public, max-age=31536000, immutable" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(Buffer.from(a.dataBase64, "base64"), {
    headers: { ...headers, "Content-Type": a.mime, "X-Content-Type-Options": "nosniff" },
  });
}
