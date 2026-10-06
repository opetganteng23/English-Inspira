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
