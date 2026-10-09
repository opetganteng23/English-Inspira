import Link from "next/link";
import { Logo } from "./Logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo dark />
        <Link href="/masuk" className="btn-solid !min-h-[40px] !px-4">Masuk</Link>
      </div>
    </header>
  );
}

export function PublicFooter({ email, whatsapp }: { email?: string; whatsapp?: string }) {
  return (
    <footer className="bg-navy text-mist">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm leading-relaxed">Platform persiapan TOEFL ITP untuk institusi mitra, dengan analisis dan konselor AI, oleh Inspira Teknologi, Telkom University, dan CoE AILO.</p>
        </div>
        <FooterCol title="BANTUAN" links={[["Masuk", "/masuk"], ["Kebijakan Privasi", "/privasi"], ["Syarat & Ketentuan", "/syarat"]]} />
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
