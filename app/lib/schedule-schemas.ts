import { z } from "zod";

export const sessionBody = z.object({
  label: z.string().trim().min(1).max(80),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  capacity: z.coerce.number().int().min(1).max(100000),
});
