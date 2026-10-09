import { PublicHeader, PublicFooter } from "@/components/PublicShell";
import { connectDB } from "@/lib/db";
import { maskName } from "@/lib/crypto";
import { Certificate } from "@/models/Itp";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document verification | English Inspira", robots: { index: false } };

export default async function Verifikasi({ params }: { params: { number: string } }) {
  let c: { number: string; type: string; userId: unknown; issuedAt: Date; data?: unknown } | null = null;
  if (/^EPTA-(ITP|RPT)-\d{4}-\d{4,6}$/.test(params.number)) { await connectDB(); c = await Certificate.findOne({ number: params.number }).lean(); }
  const d = (c?.data ?? {}) as { name?: string; scores?: { total?: number } };
  const name = c ? d.name ?? (await User.findById(c.userId as string).select("name").lean())?.name : null;
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        {c ? (
          <div className="card border-success text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-3xl text-white">✓</span>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-navy">Document verified</h1>
            <p className="mt-1 text-sm text-ink-soft">{c.type === "itp" ? "Official TOEFL ITP certificates" : "Simulation test result reports"}</p>
            <dl className="mt-6 grid gap-3 text-left text-sm">
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-ink-soft">Number</dt><dd className="font-semibold">{c.number}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-ink-soft">Issued to</dt><dd className="font-semibold">{name ? maskName(name) : "-"}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-ink-soft">Total score</dt><dd className="font-semibold">{d.scores?.total ?? "-"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Issued</dt><dd className="font-semibold">{c.issuedAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</dd></div>
            </dl>
            <p className="mt-5 rounded-lg bg-canvas p-3 text-xs text-ink-soft">{c.type === "itp" ? "Official score from the test organizer." : "A practice report, not an official TOEFL certificate. The score is an estimate."} The name is masked for privacy; match it against the document you received.</p>
          </div>
        ) : (
          <div className="card border-red-300 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-3xl text-white">!</span>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-navy">Document not found</h1>
            <p className="mt-2 text-sm text-ink-soft">Number <b>{params.number}</b> is not registered. Check the number again or rescan the QR code on the document.</p>
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
