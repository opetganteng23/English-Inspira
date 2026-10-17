import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Tes terjadwal: satu tes punya beberapa sesi (jam buka-tutup + kuota); peserta ditempatkan di tepat satu sesi per tes (kursi).
const sessionSchema = new Schema(
  {
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    opensAt: { type: Date, required: true },
    closesAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 100000 },
  },
  { timestamps: true }
);

const seatSchema = new Schema(
  {
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "TestSession", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Perpanjangan per peserta oleh admin: menggantikan jendela sesi untuk orang ini saja.
    override: { opensAt: Date, closesAt: Date, reason: String, by: { type: Schema.Types.ObjectId, ref: "User" }, at: Date },
    // Jendela yang terakhir diberitahukan lewat email; bila berbeda dengan jendela efektif, peserta perlu email jadwal baru.
    invitedAt: Date,
    invitedOpensAt: Date,
    invitedClosesAt: Date,
    remindedOpenAt: Date, // pengingat H-1 sebelum dibuka
    remindedNowAt: Date, // pengingat saat sesi dibuka
    remindedCloseAt: Date, // pengingat sebelum ditutup
  },
  { timestamps: true }
);
seatSchema.index({ testId: 1, userId: 1 }, { unique: true });

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: mongoose.Types.ObjectId };
export type SeatDoc = InferSchemaType<typeof seatSchema> & { _id: mongoose.Types.ObjectId };
export const TestSession: Model<SessionDoc> = (mongoose.models.TestSession as Model<SessionDoc>) || mongoose.model<SessionDoc>("TestSession", sessionSchema);
export const TestSeat: Model<SeatDoc> = (mongoose.models.TestSeat as Model<SeatDoc>) || mongoose.model<SeatDoc>("TestSeat", seatSchema);
