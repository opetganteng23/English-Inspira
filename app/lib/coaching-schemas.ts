import { z } from "zod";

const oid = z.string().regex(/^[0-9a-f]{24}$/);

export const slotInput = z.object({
  title: z.string().trim().max(120).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  mode: z.enum(["online", "offline"]).default("online"),
  meetingUrl: z.string().trim().max(500).optional(),
  room: z.string().trim().max(120).optional(),
  capacity: z.number().int().min(1).max(100).default(1),
  levelId: oid.nullable().optional(),
});

export const slotAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "Alasan pembatalan wajib diisi").max(300) }),
]);

export const attendanceInput = z.object({ status: z.enum(["present", "absent", "excused"]) });

export const noteInput = z.object({
  private: z.string().trim().max(4000).optional(),
  shared: z.string().trim().max(2000).optional(),
  recommendLevelUp: z.boolean().default(false),
});

export const coachParticipantAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_plan"), title: z.string().trim().min(3).max(200), dueInDays: z.number().int().min(1).max(90).default(14), skill: z.string().trim().max(40).optional(), topic: z.string().trim().max(60).optional() }),
  z.object({ action: z.literal("allow_placement_retake"), reason: z.string().trim().min(3).max(300) }),
]);
