import { connectDB } from "./db";
import { getSetting } from "@/models/Commerce";

export const GENERAL_DEFAULTS = { siteName: "Edulyfe EPTA", supportEmail: "", supportWhatsapp: "", itpOrganizer: "", refundPolicy: "", rescheduleDays: 7, idRetentionDays: 365 };

/** Pengaturan umum yang boleh tampil publik (placeholder desain diganti nilai dari admin, atau teks netral). */
export async function publicInfo() {
  await connectDB();
  const g = await getSetting("general", GENERAL_DEFAULTS);
  return {
    ...g,
    organizerText: g.itpOrganizer || "mitra penyelenggara resmi",
    rescheduleText: g.refundPolicy || `Perubahan jadwal bisa dilakukan sampai ${g.rescheduleDays} hari sebelum tes lewat menu Tes ITP Resmi. Ketentuan lengkap akan diumumkan oleh admin.`,
  };
}
