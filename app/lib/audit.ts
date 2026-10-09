import type { Types } from "mongoose";
import { AuditLog } from "@/models/AuditLog";

/** Catat aksi penting (akses data sensitif, perubahan konfigurasi, dsb.) ke audit_logs. */
export async function audit(actorId: Types.ObjectId | string | undefined, action: string, target?: string, meta?: unknown) {
  await AuditLog.create({ actorId, action, target, meta });
}
