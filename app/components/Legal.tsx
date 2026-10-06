import { PublicHeader, PublicFooter } from "./PublicShell";
import { publicInfo } from "@/lib/public-info";

/** Kerangka halaman hukum. Isi adalah DRAF operasional yang wajib ditinjau konsultan hukum sebelum rilis publik. */
export async function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  const info = await publicInfo();
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="rounded-lg bg-accent-tint p-3 text-sm text-accent-dark"><b>Draf.</b> Dokumen ini belum ditinjau konsultan hukum. Jangan dipublikasikan sebagai ketentuan final.</p>
        <h1 className="page-title mt-6">{title}</h1>
        <div className="prose-ei mt-6 text-[15px]">{children}</div>
        <p className="mt-8 text-sm text-ink-soft">Pertanyaan? {info.supportEmail ? <a className="text-brand" href={`mailto:${info.supportEmail}`}>{info.supportEmail}</a> : "Hubungi admin lewat menu Bantuan."}</p>
      </main>
      <PublicFooter email={info.supportEmail} whatsapp={info.supportWhatsapp} />
    </>
  );
}
