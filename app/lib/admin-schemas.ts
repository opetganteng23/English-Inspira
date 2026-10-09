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
    tags: z.array(z.object({ skill: z.string().trim().min(1).max(40), topic: z.string().trim().min(1).max(60) })).max(10).default([]),
    assetIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(5).default([]),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    status: z.enum(["draft", "review", "published"]).default("draft"),
  })
  .refine((q) => q.answerKey < q.options.length, { message: "The answer key is outside the options", path: ["answerKey"] })
  .refine((q) => q.status !== "published" || q.tags.length >= 1, { message: "Published questions must have a skill + topic tag", path: ["tags"] });

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
  kind: z.enum(["placement", "sim", "practice", "quiz"]),
  levelId: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional(),
  active: z.boolean().default(true),
  sections: z
    .array(
      z.object({
        name: z.enum(SECTIONS),
        durationSec: z.number().int().min(60, { message: "Minimum section duration is 1 minute" }).max(10_800, { message: "Maximum section duration is 180 minutes" }),
        questionIds: z.array(oid).min(1).max(200),
      })
    )
    .min(1)
    .max(3)
    .refine((s) => new Set(s.map((x) => x.name)).size === s.length, { message: "Sections must not be duplicated" }),
});

export const sessionInput = z.object({
  title: z.string().trim().min(1).max(120),
  date: z.coerce.date(),
  place: z.string().trim().min(1).max(200),
  organizer: z.string().trim().max(120).optional(),
  quota: z.number().int().min(1).max(5000),
  status: z.enum(["open", "closed", "done"]).default("open"),
});


export const institutionInput = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "Code must be 3-20 letters/numbers"),
  seats: z.number().int().min(0).max(100_000),
  contactEmail: z.email().optional().or(z.literal("")),
  batch: z.string().max(40).optional(),
  contractStart: z.coerce.date().optional().nullable(),
  contractEnd: z.coerce.date().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
}).refine((i) => !i.contractStart || !i.contractEnd || i.contractEnd > i.contractStart, { message: "The contract end must be after the contract start", path: ["contractEnd"] });

export const userCreateInput = z.object({
  email: z.email().max(200),
  name: z.string().trim().max(100).optional(),
  role: z.enum(["coach", "inst_admin", "admin"]),
  institutionId: z.string().regex(/^[0-9a-f]{24}$/).optional().nullable(),
});
export const userPatchInput = z.object({
  name: z.string().trim().max(100).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});
