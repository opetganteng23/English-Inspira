import mongoose, { Schema, Model } from "mongoose";

// ---- Counter atomik (nomor sertifikat dsb.) ----
const counterSchema = new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } });
export const Counter = (mongoose.models.Counter as Model<{ key: string; seq: number }>) || mongoose.model<{ key: string; seq: number }>("Counter", counterSchema);
export async function nextSeq(key: string) {
  const c = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return c.seq;
}

// ---- Pengaturan umum (key-value) ----
const settingSchema = new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed }, { timestamps: true });
export const Setting = (mongoose.models.Setting as Model<{ key: string; value: unknown }>) || mongoose.model<{ key: string; value: unknown }>("Setting", settingSchema);
export async function getSetting<T extends object>(key: string, fallback: T): Promise<T> {
  const s = await Setting.findOne({ key }).lean();
  return s ? ({ ...fallback, ...(s.value as object) } as T) : fallback;
}
