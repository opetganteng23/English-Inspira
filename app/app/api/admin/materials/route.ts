import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { handleError, HttpError } from "@/lib/rbac";
import { authorScope, requireAuthor } from "@/lib/material-authz";
import { uniqueSlug } from "@/lib/materials";
import { materialInput, normalizeMaterial } from "@/lib/material-schemas";
import { audit } from "@/lib/audit";
import { Material } from "@/models/Material";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const me = await requireAuthor();
    await connectDB();
    const list = await Material.find(authorScope(me)).select("title slug kind status access version tags updatedAt publishedAt").sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ materials: list.map((m) => ({ id: String(m._id), title: m.title, slug: m.slug, kind: m.kind, status: m.status, access: m.access, version: m.version, tags: m.tags, updatedAt: m.updatedAt })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAuthor();
    const b = normalizeMaterial(materialInput.parse(await req.json()));
    if (admin.role !== "admin" && b.kind !== "rich") throw new HttpError(403, "HTML materials are managed by admins only");
    const scope = authorScope(admin);
    await connectDB();
    const m = await Material.create({ ...b, ...scope, slug: await uniqueSlug(b.title), authorId: admin._id, editorId: admin._id });
    await audit(admin._id, "material.create", String(m._id));
    return NextResponse.json({ id: String(m._id), slug: m.slug }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}
