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
