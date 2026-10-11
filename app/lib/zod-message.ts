import type { z } from "zod";

const LABEL: Record<string, string> = {
  stem: "Question text", options: "Answer options", answerKey: "Correct answer", type: "Question type", givenName: "Given name", surname: "Surname",
  name: "Name", email: "Email", phone: "Phone number", title: "Title", description: "Description", code: "Code", password: "Password",
  groupId: "Group", instruction: "Instruction", transcript: "Transcript", testName: "Test name", durationSec: "Duration", seats: "Seats",
};
const humanize = (k: string) => LABEL[k] ?? k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** Pesan galat validasi untuk pengguna: nama kolom + penjelasan jelas. Pesan kustom yang sudah ramah dipertahankan apa adanya. */
export function zodMessage(e: z.ZodError, fallback = "Invalid input") {
  const i = e.issues[0];
  if (!i) return fallback;
  const keys = i.path.filter((p): p is string => typeof p === "string");
  const field = keys.length ? humanize(keys[keys.length - 1]) : "";
  const idx = i.path.find((p): p is number => typeof p === "number");
  const where = field ? `${field}${idx !== undefined ? ` (item ${idx + 1})` : ""}` : "";
  const m = i.message;
  const raw = /^(too small|too big|invalid|required|expected)/i.test(m);
  if (!raw) return where && !m.toLowerCase().startsWith(field.toLowerCase()) && /^[a-z]/.test(m) ? `${where}: ${m}` : m;
  const issue = i as unknown as { code: string; minimum?: number | bigint; maximum?: number | bigint; origin?: string };
  let detail = "is not valid";
  if (issue.code === "too_small") detail = Number(issue.minimum) <= 1 ? "cannot be empty" : `must have at least ${issue.minimum} ${issue.origin === "string" ? "characters" : issue.origin === "array" ? "items" : ""}`.trim();
  else if (issue.code === "too_big") detail = `is too long or too large (maximum ${issue.maximum})`;
  else if (issue.code === "invalid_type") detail = "is required or has the wrong type";
  return where ? `${where} ${detail}` : `Input ${detail}`;
}
