import Link from "next/link";
import { publicInfo } from "@/lib/public-info";

export const dynamic = "force-dynamic";

// FAQ dari kendala nyata selama placement test (Oktober 2026), dikelompokkan per tahap.
const GROUPS: [string, [string, string][]][] = [
  ["Before the test", [
    ["The Start button cannot be clicked", "The page lists what is still missing above the Start button: play the test tone and tick that you hear it, read and accept the rules, and share your entire screen if the test asks for it. Start becomes active once everything is done."],
    ["Screen sharing fails or is blocked", "Choose “Entire screen”, not a window or tab. On macOS allow screen recording for your browser in System Settings → Privacy & Security, then reopen the browser. Office laptops may block screen sharing; use a personal laptop if possible."],
    ["Which device and browser should I use?", "A laptop or PC with the latest Chrome or Edge, a stable connection, and a headset. Phones are not supported for tests that require screen sharing."],
    ["I cannot sign in", "Use the email registered by your institution and sign in with your password or an email code (OTP). If too many wrong passwords lock the account, reset your password; the lock is removed automatically."],
    ["The email code (OTP) or invitation does not arrive", "Check the spam folder and wait a minute. Codes are valid for 5 minutes; always use the code from the latest email. Invitations can be resent by your institution."],
  ]],
  ["During the test", [
    ["The page shows “Saving your answer… Do not refresh”", "Your connection is slow and the answer is still being saved. Wait until it disappears; do not refresh or close the page. Answers are only lost if you leave before saving finishes."],
    ["I cannot go back to earlier questions", "This test runs in one-way (secure) mode: once you move on, you cannot return. Answer each question before pressing Next."],
    ["The Listening audio is silent or stops", "Check the volume and headset, then press “No sound? Switch audio player”. It continues from the current position. The audio is downloaded before it plays, so a short network drop does not cut the sound."],
    ["My connection dropped or the browser closed", "Sign in again and open My Tests → Continue. Saved answers stay, and time lost while offline is returned (up to 10 minutes per section)."],
  ]],
  ["After the test", [
    ["When will I see my result?", "Results are announced by your program organizer. Until then Test Results shows that your test has been received. You will get an email when the result is released."],
    ["Other menus are missing", "Learning menus appear after your placement result is released and your level is set."],
  ]],
];

export default async function Faq() {
  const info = await publicInfo();
  return (
    <div className="page-cols">
      <div><h1 className="page-title">FAQ</h1><p className="mt-1 text-ink-soft">Answers to the most common questions, from before the test to the result.</p></div>
      {GROUPS.map(([title, items]) => (
        <section key={title} className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold text-navy">{title}</h2>
          {items.map(([q, a]) => (
            <details key={q} className="group card !p-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-navy">{q}<span className="text-xl text-brand group-open:hidden">+</span><span className="hidden text-xl text-brand group-open:inline">−</span></summary><p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{a}</p></details>
          ))}
        </section>
      ))}
      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Still need help?</h2>
        <p className="mt-1 text-sm text-ink-soft">Include your account email so we can help you quickly.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {info.supportEmail ? <a className="btn-solid" href={`mailto:${info.supportEmail}`}>Email {info.supportEmail}</a> : null}
          {info.supportWhatsapp ? <a className="btn-outline" href={`https://wa.me/${info.supportWhatsapp.replace(/\D/g, "")}`}>WhatsApp</a> : null}
          {!info.supportEmail && !info.supportWhatsapp && <p className="text-sm text-ink-soft">Admin contact details are not set yet. The admin can add them in Settings.</p>}
        </div>
        <p className="mt-4 text-sm"><Link href="/terms" className="text-brand">Terms & Conditions</Link> · <Link href="/privacy" className="text-brand">Privacy Policy</Link></p>
      </section>
    </div>
  );
}
