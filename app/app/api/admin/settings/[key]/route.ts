import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Setting, getSetting } from "@/models/Settings";
import { landingSchema, LANDING_DEFAULTS } from "@/lib/landing-settings";

export const dynamic = "force-dynamic";

// Pengaturan umum (kontak, mitra ITP, retensi). Angka sistem ada di Parameter Sistem (/api/admin/params).
const SETTINGS = {
  general: {
    schema: z.object({ siteName: z.string().min(1).max(60), supportEmail: z.email().or(z.literal("")), supportWhatsapp: z.string().max(20), itpOrganizer: z.string().max(120), refundPolicy: z.string().max(2000), rescheduleDays: z.number().int().min(0).max(60), idRetentionDays: z.number().int().min(1).max(3650) }),
    defaults: { siteName: "English Inspira", supportEmail: "", supportWhatsapp: "", itpOrganizer: "", refundPolicy: "", rescheduleDays: 7, idRetentionDays: 365 },
  },
  landing: { schema: landingSchema, defaults: LANDING_DEFAULTS },
} as const;
type Key = keyof typeof SETTINGS;

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  try {
    await requireRole(["admin"]);
    const def = SETTINGS[params.key as Key];
    if (!def) throw new HttpError(404, "Setting not found");
    await connectDB();
    return NextResponse.json(await getSetting(params.key, def.defaults));
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const def = SETTINGS[params.key as Key];
    if (!def) throw new HttpError(404, "Setting not found");
    const value = def.schema.parse(await req.json());
    await connectDB();
    await Setting.updateOne({ key: params.key }, { value }, { upsert: true });
    await audit(admin._id, "settings.update", params.key, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
