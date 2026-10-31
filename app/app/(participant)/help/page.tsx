import Link from "next/link";
import { publicInfo } from "@/lib/public-info";
import { PARTICIPANT_FAQ as GROUPS } from "@/lib/faq";
import { FaqList } from "@/components/FaqList";

export const dynamic = "force-dynamic";

export default async function Faq() {
  const info = await publicInfo();
  return (
    <div className="page-cols">
      <div><h1 className="page-title">FAQ</h1><p className="mt-1 text-ink-soft">Answers to the most common questions, from before the test to the result.</p></div>
      <FaqList groups={GROUPS} />
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
