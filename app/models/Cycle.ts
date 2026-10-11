import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Program Cycle (MTS 5.1): periode resmi belajar sebuah institusi, mengikuti kontrak atau kalender akademik.
// Status `scheduled | active | closed` diturunkan dari tanggal dan `closedAt` (penutupan manual), bukan disimpan.
const cycleSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    durationSource: { type: String, trim: true, maxlength: 200 }, // dasar tanggal: kontrak atau kalender akademik
    closedAt: Date,
    itpDate: Date, // jadwal ITP resmi untuk periode ini (opsional)
    itpRequired: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export type CycleDoc = InferSchemaType<typeof cycleSchema> & { _id: mongoose.Types.ObjectId };
export const ProgramCycle: Model<CycleDoc> = (mongoose.models.ProgramCycle as Model<CycleDoc>) || mongoose.model<CycleDoc>("ProgramCycle", cycleSchema);
