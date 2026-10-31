import { getCurrentUser } from "@/lib/auth";
import { MyRequests } from "./MyRequests";
import { SupportForm } from "@/components/SupportForm";
import { FaqList } from "@/components/FaqList";
import { INSTITUTION_FAQ, COACH_FAQ } from "@/lib/faq";

/** Bantuan: kirim permintaan (siapa saja) dan daftar permintaan saya (8.3, bila login). */
export default async function Support() {
  const user = await getCurrentUser();
  const faq = user?.role === "inst_admin" ? INSTITUTION_FAQ : user?.role === "coach" ? COACH_FAQ : null;
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Help & support</h1><p className="text-sm text-ink-soft">Tell us what went wrong. Our team replies here and by email{user ? "" : " (we send a link to follow your request)"}.</p></div>
      <section className="card"><h2 className="mb-3 font-display text-lg font-extrabold text-navy">New request</h2><SupportForm signedIn={!!user} /></section>
      {user && <MyRequests />}
      {faq && <div id="faq" className="flex flex-col gap-4"><h2 className="font-display text-xl font-extrabold text-navy">Common questions</h2><FaqList groups={faq} /></div>}
    </div>
  );
}
