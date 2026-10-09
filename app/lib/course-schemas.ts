import { z } from "zod";

const oid = z.string().regex(/^[0-9a-f]{24}$/);

export const courseInput = z.object({
  levelId: oid,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const unitInput = z.object({
  courseId: oid,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).max(1000).default(0),
  materialIds: z.array(oid).max(30).default([]),
  quizTestId: oid.nullable().optional(),
  active: z.boolean().default(true),
});

export const eventInput = z.object({
  kind: z.enum(["material", "unit"]),
  refId: oid,
  activeSec: z.number().min(0).max(60),
});
