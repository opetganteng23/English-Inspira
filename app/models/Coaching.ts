import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Slot coaching (MTS §16). capacity = 1 untuk individu; > 1 berfungsi sebagai kelas kecil.
const slotSchema = new Schema(
  {
    coachId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true },
    levelId: { type: Schema.Types.ObjectId, ref: "Level" }, // kosong = semua level
    title: String,
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    mode: { type: String, enum: ["online", "offline"], default: "online" },
    meetingUrl: String,
    room: String,
    capacity: { type: Number, default: 1, min: 1, max: 100 },
    booked: { type: Number, default: 0 }, // jumlah booking aktif; diubah hanya lewat update atomik
    status: { type: String, enum: ["draft", "published", "cancelled"], default: "draft", index: true },
    cancelReason: String,
    reminded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const bookingSchema = new Schema(
  {
    slotId: { type: Schema.Types.ObjectId, ref: "CoachSlot", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true },
    // booked → (cancelled | present | absent | excused). Kuota dipakai menurut quota_rules dan idempoten lewat quotaCharged.
    status: { type: String, enum: ["booked", "cancelled", "present", "absent", "excused"], default: "booked" },
    quotaCharged: { type: Boolean, default: false },
    active: { type: Boolean, default: true }, // false setelah dibatalkan; membebaskan peserta memesan ulang slot yang sama
    cancelledBy: { type: String, enum: ["participant", "coach", "admin"] },
    markedAt: Date,
  },
  { timestamps: true }
);
// Satu peserta tidak bisa punya dua booking aktif pada slot yang sama.
bookingSchema.index({ slotId: 1, userId: 1 }, { unique: true, partialFilterExpression: { active: true } });

// Catatan sesi: `private` hanya untuk coach/admin; `shared` boleh dilihat peserta. inst_admin tidak pernah melihat keduanya (MTS §4).
const noteSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    private: String,
    shared: String,
    recommendLevelUp: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type SlotDoc = InferSchemaType<typeof slotSchema> & { _id: mongoose.Types.ObjectId };
export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: mongoose.Types.ObjectId };
export const CoachSlot: Model<SlotDoc> = (mongoose.models.CoachSlot as Model<SlotDoc>) || mongoose.model<SlotDoc>("CoachSlot", slotSchema);
export const Booking: Model<BookingDoc> = (mongoose.models.Booking as Model<BookingDoc>) || mongoose.model<BookingDoc>("Booking", bookingSchema);
export const SessionNote = (mongoose.models.SessionNote as Model<InferSchemaType<typeof noteSchema>>) || mongoose.model("SessionNote", noteSchema);
