import { connectDB } from "./db";
import { getSetting } from "@/models/Settings";

export const GENERAL_DEFAULTS = { siteName: "English Inspira", supportEmail: "", supportWhatsapp: "", itpOrganizer: "", refundPolicy: "", rescheduleDays: 7, idRetentionDays: 365 };

/** Pengaturan umum yang boleh tampil publik (placeholder desain diganti nilai dari admin, atau teks netral). */
export async function publicInfo() {
  await connectDB();
  const g = await getSetting("general", GENERAL_DEFAULTS);
  return {
    ...g,
    organizerText: g.itpOrganizer || "official partner organizer",
    rescheduleText: g.refundPolicy || `Schedule changes can be made up to ${g.rescheduleDays} days before the test from the Official ITP Test menu. Full terms will be announced by the admin.`,
  };
}
