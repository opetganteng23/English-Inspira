import Link from "next/link";
import { Logo } from "./Logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo dark />
        <Link href="/masuk" className="btn-solid !min-h-[40px] !px-4">Sign in</Link>
      </div>
    </header>
  );
}

export function PublicFooter({ email, whatsapp }: { email?: string; whatsapp?: string }) {
  return (
    <footer className="bg-navy text-mist">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm leading-relaxed">A TOEFL ITP preparation platform for partner institutions, with AI analysis and an AI counselor, by Inspira Teknologi, Telkom University, and CoE AILO.</p>
        </div>
        <FooterCol title="PROGRAM" links={[["How it works", "/#how"], ["AI Counselor", "/#counselor"], ["For institutions", "/#institutions"], ["FAQ", "/#faq"]]} />
        <FooterCol title="HELP" links={[["Sign in", "/masuk"], ["Privacy Policy", "/privasi"], ["Terms & Conditions", "/syarat"]]} />
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">CONTACT</p>
          <span>inspiratekno.com</span>
          {email && <a href={`mailto:${email}`} className="hover:text-white">{email}</a>}
          {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="hover:text-white">WhatsApp {whatsapp}</a>}
          <span>Kec. Tangerang, Kota Tangerang, Banten 15119</span>
        </div>
      </div>
      <div className="border-t border-navy-700 px-4 py-4 text-center text-xs sm:px-6">
        © {new Date().getFullYear()} Inspira Teknologi. All rights reserved. TOEFL and TOEFL ITP are registered trademarks of ETS.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">{title}</p>
      {links.map(([l, h]) => <Link key={h} href={h} className="hover:text-white">{l}</Link>)}
    </div>
  );
}
