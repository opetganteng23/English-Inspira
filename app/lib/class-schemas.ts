import { z } from "zod";

const oid = z.string().regex(/^[0-9a-f]{24}$/);
export const classInput = z.object({
  name: z.string().trim().min(1).max(60),
  levelId: oid,
  institutionId: oid.nullable().optional(),
  programCycleId: oid.nullable().optional(),
  capacity: z.number().int().min(1).max(500),
  coachId: oid.nullable().optional(),
  active: z.boolean().default(true),
});
export const moveInput = z.object({ userId: oid, classId: oid.nullable() });
