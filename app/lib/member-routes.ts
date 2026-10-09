import { NextResponse } from "next/server";
import { z } from "zod";
import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { parseMembersFile } from "./import-parse";
import { importMembers } from "./import-members";

/** Logika bersama endpoint impor/undangan untuk admin dan inst_admin (keduanya memanggil dengan institusi yang sudah dipastikan). */
export async function handleImport(req: Request, institutionId: Types.ObjectId | string, actorId: Types.ObjectId | string) {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new HttpError(400, "File wajib diisi");
  const rows = await parseMembersFile(file);
  return NextResponse.json(await importMembers(institutionId, rows, actorId));
}

const invitesSchema = z.object({ emails: z.array(z.string().trim().toLowerCase()).min(1, "Isi minimal satu email").max(100, "Maksimal 100 email per kirim") });
export async function handleInvites(req: Request, institutionId: Types.ObjectId | string, actorId: Types.ObjectId | string) {
  const { emails } = invitesSchema.parse(await req.json());
  const rows = Array.from(new Set(emails)).map((email, i) => ({ row: i + 1, email }));
  return NextResponse.json(await importMembers(institutionId, rows, actorId));
}
