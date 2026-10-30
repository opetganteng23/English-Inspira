import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Tiket bantuan (Sesi 8): kendala peserta, institusi, dan coach masuk lewat sistem, bukan WhatsApp.
// Kategori menentukan tim: CS (akun, jadwal, umum) atau Technical (saat tes, audio). Admin bisa memindahkan tiket antartim.
export const TICKET_CATEGORIES = ["account", "schedule", "during_test", "audio", "other"] as const;
export const TICKET_STATUS = ["new", "in_progress", "waiting", "resolved"] as const;

const messageSchema = new Schema(
  {
    from: { type: String, enum: ["user", "staff", "system"], required: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: String,
    body: { type: String, required: true, maxlength: 4000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new Schema(
  {
    number: { type: Number, required: true, unique: true }, // nomor tiket untuk disebut ke pengguna (#1024)
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true }, // kosong bila dikirim tanpa login (halaman sign-in)
    role: String,
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution" },
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 200, index: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    team: { type: String, enum: ["cs", "tech"], required: true, index: true },
    status: { type: String, enum: TICKET_STATUS, default: "new", index: true },
    urgent: { type: Boolean, default: false, index: true },
    page: { type: String, maxlength: 300 }, // halaman tempat tombol Help ditekan
    userAgent: { type: String, maxlength: 300 },
    messages: [messageSchema],
    lastUserAt: Date,
    lastStaffAt: Date,
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    accessToken: { type: String, required: true, select: false }, // tautan di email bagi pengirim tanpa akun
    resolvedAt: Date,
  },
  { timestamps: true }
);
ticketSchema.index({ team: 1, status: 1, updatedAt: -1 });

export type TicketDoc = InferSchemaType<typeof ticketSchema> & { _id: mongoose.Types.ObjectId };
export const Ticket: Model<TicketDoc> = (mongoose.models.Ticket as Model<TicketDoc>) || mongoose.model<TicketDoc>("Ticket", ticketSchema);
