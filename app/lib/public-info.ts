import { connectDB } from "./db";
import { getSetting } from "@/models/Settings";
import { LANDING_DEFAULTS } from "./landing-settings";

export const GENERAL_DEFAULTS = { siteName: "English Inspira", supportEmail: "", supportWhatsapp: "", itpOrganizer: "", refundPolicy: "", rescheduleDays: 7, idRetentionDays: 365 };

/** Pengaturan umum yang boleh tampil publik (placeholder desain diganti nilai dari admin, atau teks netral). */
export async function publicInfo() {
  await connectDB();
  const g = await getSetting("general", GENERAL_DEFAULTS);
  const landing = await getSetting("landing", LANDING_DEFAULTS);
  return {
    ...g,
    landing,
    organizerText: g.itpOrganizer || "official partner organizer",
    rescheduleText: g.refundPolicy || `Schedule changes can be made up to ${g.rescheduleDays} days before the test from the Official EPTA Test menu. Full terms will be announced by the admin.`,
  };
}
