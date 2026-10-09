import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/materials";
import { materialInput, normalizeMaterial } from "@/lib/material-schemas";
import { audit } from "@/lib/audit";
import { Material } from "@/models/Material";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const list = await Material.find().select("title slug kind status access version tags updatedAt publishedAt").sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ materials: list.map((m) => ({ id: String(m._id), title: m.title, slug: m.slug, kind: m.kind, status: m.status, access: m.access, version: m.version, tags: m.tags, updatedAt: m.updatedAt })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = normalizeMaterial(materialInput.parse(await req.json()));
    await connectDB();
    const m = await Material.create({ ...b, slug: await uniqueSlug(b.title), authorId: admin._id });
    await audit(admin._id, "material.create", String(m._id));
    return NextResponse.json({ id: String(m._id), slug: m.slug }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
