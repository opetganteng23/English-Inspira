import { z } from "zod";

export const cycleInput = z.object({
  institutionId: z.string().regex(/^[0-9a-f]{24}$/),
  name: z.string().trim().min(1).max(120),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  durationSource: z.string().trim().max(200).optional(),
  itpDate: z.coerce.date().optional().nullable(),
  itpRequired: z.boolean().default(false),
}).refine((c) => c.endsAt > c.startsAt, { message: "The end must be after the start", path: ["endsAt"] });

export const cycleAction = z.object({ action: z.enum(["close", "reopen"]) });
