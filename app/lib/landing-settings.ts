import { z } from "zod";

/** Pengaturan tampilan landing (hero, teks berjalan, logo mitra). Disimpan di Setting key "landing"; dapat diubah admin di Settings. */
export type Partner = { name: string; logoId: string };
export type LandingSettings = {
  badge: string; title: string; subtitle: string;
  bgImageId: string; overlay: number; theme: "light" | "dark"; showExample: boolean;
  marquee: string[]; partners: Partner[];
};

export const LANDING_DEFAULTS: LandingSettings = {
  badge: "TOEFL ITP Preparation Program 2026",
  title: "Know your TOEFL ITP score. Know what to do next.",
  subtitle: "ITP-format tests, AI analysis for every section, and an AI Counselor that plans your next steps, until you are ready to register for the official TOEFL ITP.",
  bgImageId: "", overlay: 60, theme: "light", showExample: true,
  marquee: ["Know your score", "AI analysis per section", "Personal AI Counselor", "Study plan that fits your time", "Official TOEFL ITP registration", "English Intelligence Journey"],
  partners: [{ name: "Inspira Teknologi", logoId: "" }, { name: "Telkom University", logoId: "" }, { name: "CoE AILO", logoId: "" }],
};

const oid = z.string().regex(/^[0-9a-f]{24}$/, "Invalid image").or(z.literal(""));
export const landingSchema = z.object({
  badge: z.string().trim().max(80),
  title: z.string().trim().min(1, "Enter a headline").max(140),
  subtitle: z.string().trim().max(320),
  bgImageId: oid,
  overlay: z.number().int().min(0).max(90),
  theme: z.enum(["light", "dark"]),
  showExample: z.boolean(),
  marquee: z.array(z.string().trim().min(1).max(60)).max(10),
  partners: z.array(z.object({ name: z.string().trim().min(1, "Partner name cannot be empty").max(60), logoId: oid })).max(10),
});
