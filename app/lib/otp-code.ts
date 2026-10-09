import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { Otp } from "@/models/Otp";
import { HttpError } from "./rbac";
import { enqueueMail } from "./mailq";
import type { TemplateName } from "./mail-templates";

const MAX_ATTEMPTS = 5;
export const CODE_BAD = "The code has expired or is locked. Request a new code.";

/** Satu kode 6 digit aktif per email (berlaku 5 menit), dikirim lewat template yang diberikan. */
export async function issueCode(email: string, template: TemplateName) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await Otp.deleteMany({ email });
  await Otp.create({ email, codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + 5 * 60_000) });
  await enqueueMail(email, template, { code }, { priority: 1 });
}

/** Cek kode: percobaan dinaikkan atomik sebelum dibandingkan; kode sekali pakai. Melempar HttpError bila salah. */
export async function consumeCode(email: string, code: string) {
  const otp = await Otp.findOneAndUpdate({ email, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true });
  if (!otp) throw new HttpError(400, CODE_BAD);
  if (!(await bcrypt.compare(code, otp.codeHash))) {
    const left = MAX_ATTEMPTS - otp.attempts;
    throw new HttpError(400, left > 0 ? `Wrong code. Attempts left: ${left}. Make sure you use the code from the latest email.` : "The code is locked. Request a new code.");
  }
  await Otp.deleteMany({ email });
}
