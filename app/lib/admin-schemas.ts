import { z } from "zod";
import { SECTIONS } from "@/models/Question";

export const questionSchema = z
  .object({
    section: z.enum(SECTIONS),
    type: z.string().trim().min(1).max(60),
    groupId: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional(),
    stem: z.string().trim().min(1).max(4000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    answerKey: z.number().int().min(0),
    explanation: z.string().max(4000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    assetIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(5).default([]),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    status: z.enum(["draft", "review", "published"]).default("draft"),
  })
  .refine((q) => q.answerKey < q.options.length, { message: "Kunci jawaban di luar pilihan", path: ["answerKey"] });

export const groupSchema = z.object({
  section: z.enum(SECTIONS),
  instruction: z.string().max(1000).optional(),
  audioId: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional(),
  passageTitle: z.string().max(200).optional(),
  passageHtml: z.string().max(100_000).optional(),
  assetIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(10).default([]),
});

const oid = z.string().regex(/^[0-9a-f]{24}$/);
export const testSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["trial", "diagnostic", "prediction", "sim"]),
  active: z.boolean().default(true),
  sections: z
    .array(
      z.object({
        name: z.enum(SECTIONS),
        durationSec: z.number().int().min(60, { message: "Durasi section minimal 1 menit" }).max(10_800, { message: "Durasi section maksimal 180 menit" }),
        questionIds: z.array(oid).min(1).max(200),
      })
    )
    .min(1)
    .max(3)
    .refine((s) => new Set(s.map((x) => x.name)).size === s.length, { message: "Section tidak boleh dobel" }),
});

export const sessionInput = z.object({
  title: z.string().trim().min(1).max(120),
  date: z.coerce.date(),
  place: z.string().trim().min(1).max(200),
  organizer: z.string().trim().max(120).optional(),
  quota: z.number().int().min(1).max(5000),
  status: z.enum(["open", "closed", "done"]).default("open"),
});


export const productInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "Slug: huruf kecil, angka, strip"),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  kind: z.enum(["single_sim", "itp_only", "journey", "bundle"]),
  price: z.number().int().min(0).max(100_000_000),
  entitlements: z.array(z.object({ kind: z.enum(["test", "counselor", "itp", "materials"]), ref: z.string().max(30).optional(), qty: z.number().int().min(0).max(1000) })).max(12),
  validDays: z.number().int().min(0).max(1095).default(0),
  highlight: z.boolean().optional(),
  badge: z.string().max(30).optional(),
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const voucherInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Kode 3–30 karakter: huruf, angka, _ atau -"),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1),
    maxUse: z.number().int().min(0).default(0),
    validUntil: z.coerce.date().optional().nullable(),
    active: z.boolean().default(true),
  })
  .refine((v) => v.type !== "percent" || v.value <= 100, { message: "Diskon persen maksimal 100", path: ["value"] });

export const institutionInput = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "Kode 3–20 karakter huruf/angka"),
  seats: z.number().int().min(0).max(100_000),
  contactEmail: z.email().optional().or(z.literal("")),
  batch: z.string().max(40).optional(),
  productId: z.string().regex(/^[0-9a-f]{24}$/).optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
  active: z.boolean().default(true),
});

export const userCreateInput = z.object({
  email: z.email().max(200),
  name: z.string().trim().max(100).optional(),
  role: z.enum(["participant", "admin", "inst_admin"]),
  institutionId: z.string().regex(/^[0-9a-f]{24}$/).optional().nullable(),
});
export const userPatchInput = z.object({
  name: z.string().trim().max(100).optional(),
  role: z.enum(["participant", "admin", "inst_admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  institutionId: z.string().regex(/^[0-9a-f]{24}$/).optional().nullable(),
});
