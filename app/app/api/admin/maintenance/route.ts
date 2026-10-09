import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError } from "@/lib/rbac";
import { getMaintenance, setMaintenance } from "@/lib/maintenance";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await getMaintenance());
  } catch (e) {
    return handleError(e);
  }
}

const body = z.object({ on: z.boolean(), message: z.string().max(300).optional() });

/** Nyalakan/matikan mode pemeliharaan. Tercatat di audit log. */
export async function PUT(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = body.parse(await req.json());
    const m = await setMaintenance(b.on, b.message ?? "", String(admin._id));
    await audit(admin._id, b.on ? "maintenance.on" : "maintenance.off", "maintenance", { message: m.message });
    return NextResponse.json(m);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}
