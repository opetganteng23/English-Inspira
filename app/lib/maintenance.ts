import { connectDB } from "./db";
import { ConfigParam } from "@/models/Config";

export type Maintenance = { on: boolean; message: string; since: string | null };
const KEY = "maintenance";

/** Status mode pemeliharaan (disimpan di config_params). Saat aktif hanya admin yang bisa memakai aplikasi. */
export async function getMaintenance(): Promise<Maintenance> {
  await connectDB();
  const row = await ConfigParam.findOne({ key: KEY }).lean();
  const v = (row?.value ?? {}) as Partial<Maintenance>;
  return { on: !!v.on, message: typeof v.message === "string" ? v.message : "", since: v.since ?? null };
}

export async function setMaintenance(on: boolean, message: string, by: string) {
  await connectDB();
  const value: Maintenance = { on, message: message.trim().slice(0, 300), since: on ? new Date().toISOString() : null };
  await ConfigParam.updateOne({ key: KEY }, { value, updatedBy: by }, { upsert: true });
  return value;
}
