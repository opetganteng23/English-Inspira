import Link from "next/link";
import { publicInfo } from "@/lib/public-info";

export const dynamic = "force-dynamic";

const TOPICS: [string, string][] = [
  ["My test stopped halfway", "Open My Tests and click Continue. The timer runs on the server and answers are saved automatically every few seconds, so a refresh or lost connection does not lose your answers."],
  ["Listening audio does not play", "Check the volume and headset, then click “Reload audio”. Audio can only be played once, but reloading after a loading failure does not count as replaying."],
  ["I cannot sign in / my access has ended", "Your account is created and managed by your institution. If the message says your access has ended, contact your institution admin because access follows the contract period."],
  ["I did not receive the invitation email", "Check your spam folder. Invitations are valid for 7 days; your institution admin can resend them."],
  ["The OTP code does not arrive", "Check your spam folder, then request a new code after 60 seconds. Codes are valid for 5 minutes and lock after 5 wrong attempts. Always use the code from the latest email."],
  ["My name on the ITP registration is wrong", "The name is locked after the registration is submitted. Contact the admin before the test date using the contact below."],
  ["How do I cancel or change my ITP schedule?", "Open Official ITP Test and click “Change schedule / cancel” on your registration. Available until the cut-off before the test."],
];

export default async function Bantuan() {
  const info = await publicInfo();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div><h1 className="page-title">Help</h1><p className="mt-1 text-ink-soft">Answers to the most common questions.</p></div>
      <div className="flex flex-col gap-3">
        {TOPICS.map(([q, a]) => (
          <details key={q} className="group card !p-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-navy">{q}<span className="text-xl text-brand group-open:hidden">+</span><span className="hidden text-xl text-brand group-open:inline">−</span></summary><p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{a}</p></details>
        ))}
      </div>
      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Still need help?</h2>
        <p className="mt-1 text-sm text-ink-soft">Include your account email so we can help you quickly.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {info.supportEmail ? <a className="btn-solid" href={`mailto:${info.supportEmail}`}>Email {info.supportEmail}</a> : null}
          {info.supportWhatsapp ? <a className="btn-outline" href={`https://wa.me/${info.supportWhatsapp.replace(/\D/g, "")}`}>WhatsApp</a> : null}
          {!info.supportEmail && !info.supportWhatsapp && <p className="text-sm text-ink-soft">Admin contact details are not set yet. The admin can add them in Settings.</p>}
        </div>
        <p className="mt-4 text-sm"><Link href="/syarat" className="text-brand">Terms & Conditions</Link> · <Link href="/privasi" className="text-brand">Privacy Policy</Link></p>
      </section>
    </div>
  );
}
