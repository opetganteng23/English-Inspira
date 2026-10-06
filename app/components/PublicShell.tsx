import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#konselor", label: "Konselor AI" },
  { href: "/#free-trial", label: "Free Trial" },
  { href: "/#paket", label: "Paket & Harga" },
  { href: "/#institusi", label: "Untuk Institusi" },
  { href: "/#faq", label: "FAQ" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo dark />
        <nav aria-label="Menu utama" className="hidden items-center gap-6 text-sm font-medium text-ink-soft lg:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="hover:text-brand">{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/masuk" className="btn-outline !min-h-[40px] !px-4">Masuk</Link>
          <Link href="/daftar" className="btn-solid !min-h-[40px] !px-4">Coba Gratis</Link>
          <details className="relative lg:hidden">
            <summary aria-label="Menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line-strong">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-navy hover:bg-brand-tint">{n.label}</Link>)}
            </div>
          </details>
        </div>
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
          <p className="text-sm leading-relaxed">Tes simulasi format TOEFL ITP dengan analisis dan konselor AI oleh Inspira Teknologi, Telkom University, dan CoE AILO.</p>
        </div>
        <FooterCol title="PROGRAM" links={[["Cara Kerja", "/#cara-kerja"], ["Konselor AI", "/#konselor"], ["Free Trial", "/#free-trial"], ["Paket & Harga", "/#paket"]]} />
        <FooterCol title="BANTUAN" links={[["FAQ", "/#faq"], ["Kebijakan Privasi", "/privasi"], ["Syarat & Ketentuan", "/syarat"], ["Kebijakan Refund", "/refund"]]} />
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">KONTAK</p>
          <span>inspiratekno.com</span>
          {email && <a href={`mailto:${email}`} className="hover:text-white">{email}</a>}
          {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="hover:text-white">WhatsApp {whatsapp}</a>}
          <span>Kec. Tangerang, Kota Tangerang, Banten 15119</span>
        </div>
      </div>
      <div className="border-t border-navy-700 px-4 py-4 text-center text-xs sm:px-6">
        © {new Date().getFullYear()} Inspira Teknologi. Hak cipta dilindungi. TOEFL dan TOEFL ITP adalah merek dagang terdaftar milik ETS.
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
