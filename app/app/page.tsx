import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Commerce";
import { publicInfo } from "@/lib/public-info";
import { PublicHeader, PublicFooter } from "@/components/PublicShell";
import { LeadForm } from "@/components/LeadForm";

export const dynamic = "force-dynamic";

const PHASES = [
  ["01", "Discover", "Know where you stand", "Diagnostic 1", "Tes format ITP: skor awal per section dan per tipe soal."],
  ["02", "Learn", "Learn with purpose", "Konselor AI", "Rencana belajar mandiri yang disusun dari hasil tesmu."],
  ["03", "Analyze", "Turn results into insight", "Diagnostic 2–3", "Analisis AI: pola kesalahan dan alasan di balik skormu."],
  ["04", "Improve", "Focus on what matters most", "Rencana aksi", "Konseling berkala, fokus ke section yang paling jauh dari target."],
  ["05", "Experience", "Simulate the real test", "Prediction 1", "Simulasi penuh 140 soal dengan timer dan pencatatan aktivitas tes."],
  ["06", "Measure", "Validate readiness", "Diagnostic 4 · Prediction 2", "Ukur perkembangan dan tentukan kesiapan sebelum tes resmi."],
  ["07", "Certify", "Achieve your goal", "ITP resmi", "Ikuti tes TOEFL ITP resmi sesuai jadwal dan dapatkan sertifikat."],
];
const AUDIENCE = [
  ["Pelajar SMA/SMK", "Persiapan kelulusan, beasiswa, dan studi lanjut."], ["Mahasiswa", "Syarat kelulusan, S2, dan beasiswa."], ["Profesional", "Syarat rekrutmen, promosi, dan karier global."],
  ["Instansi pemerintah", "Pengembangan kompetensi ASN dan aparatur."], ["Perusahaan", "Pemetaan kemampuan bahasa Inggris karyawan."], ["Kampus & sekolah", "Mengukur dan meningkatkan kualitas lulusan."],
];
const BULLETS: Record<string, string[]> = {
  "sim-1": ["140 soal · ±115 menit · pencatatan aktivitas tes", "Laporan lengkap + analisis AI", "Pembahasan semua soal", "Konselor AI 30 hari"],
  "itp-only": ["1× tes TOEFL ITP resmi", "Pilih jadwal & lokasi", "Pengingat jadwal lewat email", "Skor & sertifikat resmi"],
  "itp-sim-bundle": ["2× Tes Simulasi ITP", "1× tes TOEFL ITP resmi", "Konselor AI selama masa paket", "Lebih hemat dari beli terpisah"],
  "journey-6m": ["4× Diagnostic + 2× Prediction", "1× tes TOEFL ITP resmi", "Konselor AI tanpa batas 6 bulan", "Materi lengkap + grafik perkembangan"],
};
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

export default async function Landing() {
  await connectDB();
  const [products, info] = await Promise.all([Product.find({ active: true }).sort({ sort: 1 }).lean(), publicInfo()]);
  const faqs: [string, string][] = [
    ["Apakah tes di sini sama dengan TOEFL ITP resmi?", `Tes simulasi kami mengikuti format TOEFL ITP (Listening, Structure & Written Expression, Reading) dan memberi estimasi skor. Skor resmi hanya dari tes TOEFL ITP yang diselenggarakan oleh ${info.organizerText}, yang bisa kamu daftarkan di sini.`],
    ["Apa yang bisa ditanyakan ke konselor AI?", "Apa saja tentang hasil tesmu: kenapa skor suatu section rendah, apa yang harus dilakukan minggu ini, berapa lama sampai target, atau apakah kamu siap tes resmi."],
    ["Kapan paket yang saya beli bisa dipakai?", "Langsung setelah pembayaran berhasil. Midtrans mengirim konfirmasi ke sistem kami, lalu tes atau pendaftaran ITP otomatis terbuka di akunmu."],
    ["Metode pembayaran apa saja yang tersedia?", "Virtual Account bank, QRIS, e-wallet, dan kartu kredit melalui Midtrans. Batas waktu pembayaran 24 jam."],
    ["Perangkat apa yang dibutuhkan?", "Laptop, tablet, atau ponsel dengan headset dan koneksi stabil. Tes dikerjakan dalam layar penuh; kami hanya mencatat aktivitas seperti pindah tab, tanpa kamera atau mikrofon."],
    ["Apakah bisa dibayar oleh kampus atau perusahaan?", "Bisa. Institusi mendapat kode institusi, invoice resmi, dan dashboard hasil kelompok."],
    ["Bagaimana jika berhalangan di jadwal tes ITP resmi?", info.rescheduleText],
  ];

  return (
    <>
      <PublicHeader />
      <main>
        {/* Hero */}
        <section className="bg-gradient-to-b from-brand-tint to-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <span className="badge-warn">Program Persiapan TOEFL ITP 2026</span>
              <h1 className="mt-4 font-display text-[32px] font-extrabold leading-[1.15] text-navy sm:text-5xl">Tahu skor TOEFL ITP-mu. Tahu harus berbuat apa.</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">Tes simulasi dengan format TOEFL ITP, analisis AI per section, dan konselor AI yang menyusun langkah berikutnya, sampai kamu siap mendaftar tes ITP resmi.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/daftar" className="btn-accent !min-h-[52px] !px-7 text-base">Coba Free Trial — Gratis</Link>
                <Link href="#paket" className="btn-outline !min-h-[52px] !px-7 text-base">Lihat Paket</Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
                <li>✓ 42 soal format ITP · ±37 menit</li><li>✓ Hasil + 3 pertanyaan ke konselor AI</li>
              </ul>
            </div>
            <div className="card shadow-lg" aria-label="Contoh hasil dan konseling">
              <p className="text-xs font-semibold tracking-wider text-brand">CONTOH HASIL & KONSELING</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div><p className="font-display text-5xl font-extrabold text-navy">497</p><p className="text-sm text-ink-soft">Estimasi skor ITP · skala 310–677</p></div>
                <span className="badge-warn">Target 550</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Listening", 49], ["Structure", 51], ["Reading", 49]].map(([k, v]) => <div key={k} className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">{k}</p><p className="font-display text-xl font-extrabold text-navy">{v}</p></div>)}
              </div>
              <div className="mt-4 rounded-xl bg-brand-tint p-3 text-sm"><b className="text-brand">Kamu:</b> Apa yang harus saya lakukan supaya bisa 550?</div>
              <div className="mt-2 rounded-xl border border-line p-3 text-sm leading-relaxed"><b className="text-navy">AI:</b> Kamu kurang ±53 poin. Paling cepat dari Structure: 5 dari 7 salahmu soal subject–verb agreement. Latihan 20 soal/hari, lalu tes lagi dalam 2 minggu.</div>
            </div>
          </div>
          <div className="border-y border-line bg-white py-5 text-center text-sm text-ink-soft"><span className="px-4">Dikembangkan dan dimiliki oleh <b className="text-navy">Inspira Teknologi</b> · <b className="text-navy">Telkom University</b> · <b className="text-navy">CoE AILO</b> (Center of Excellence Artificial Intelligence for Learning and Optimization)</span></div>
        </section>

        {/* Cara kerja */}
        <section id="cara-kerja" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-brand">CARA KERJA</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy sm:text-4xl">Tes, pahami, lakukan, ukur lagi.</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Setiap hasil tes diikuti penjelasan dan langkah konkret, lalu diukur ulang supaya kamu tahu apakah caranya berhasil.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["Tes format ITP", "Listening, Structure & Written Expression, Reading dengan timer asli."], ["Hasil + analisis AI", "Estimasi skor, skor per section, dan pola kesalahan per tipe soal."], ["Konseling AI", "Tanya apa yang harus dilakukan. Dapat rencana aksi dan pengingat."], ["Daftar ITP resmi", "Saat skor simulasi sudah di target, daftar tes resmi langsung di sini."]].map(([t, d], i) => (
              <div key={t} className="card"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy font-display font-extrabold text-white">{i + 1}</span><h3 className="mt-3 font-display text-lg font-extrabold text-navy">{t}</h3><p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p></div>
            ))}
          </div>
        </section>

        {/* Konselor AI */}
        <section id="konselor" className="scroll-mt-20 bg-navy text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">KONSELOR AI</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Bukan cuma skor. Ada yang menjelaskan dan mengarahkan.</h2>
              <p className="mt-3 text-mist">Dikembangkan bersama CoE AILO Telkom University. Konselor AI membaca semua hasil tesmu, termasuk jawaban per soal dan waktu pengerjaan.</p>
              <ul className="mt-5 flex flex-col gap-2 text-mist">
                {["Menjelaskan kenapa skor tiap section seperti itu", "Menyusun rencana sesuai waktu yang kamu punya", "Rencana aksi yang bisa dicentang + pengingat email mingguan", "Memberi tahu kapan kamu siap mendaftar tes resmi"].map((x) => <li key={x} className="flex gap-2"><span className="text-accent">✓</span>{x}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-5 text-ink">
              <div className="rounded-xl border border-line p-3 text-sm leading-relaxed"><b className="text-navy">AI:</b> Reading-mu 49. Masalahnya waktu: 4 soal terakhir tidak terjawab karena habis di passage ke-3.</div>
              <div className="mt-2 rounded-xl bg-brand-tint p-3 text-sm"><b className="text-brand">Kamu:</b> Saya cuma punya 30 menit sehari.</div>
              <div className="mt-2 rounded-xl border border-line p-3 text-sm leading-relaxed"><b className="text-navy">AI:</b> Bisa. 15 menit Structure, 15 menit satu passage Reading dengan timer. Listening cukup 2× seminggu. Tes berikutnya kita geser 1 minggu.</div>
              <p className="mt-3 text-xs font-semibold text-success">✓ Rencana aksi diperbarui · pengingat email tiap Senin</p>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-brand">ENGLISH INTELLIGENCE JOURNEY™</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy sm:text-4xl">Tujuh tahap. Satu perjalanan utuh.</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Semua tahap ada di Paket Journey. Kamu juga bisa membeli satu tes atau pendaftaran ITP saja.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PHASES.map(([no, name, tag, tool, desc]) => (
              <li key={no} className="card"><p className="text-xs font-semibold tracking-wider text-accent-dark">PHASE {no}</p><h3 className="font-display text-xl font-extrabold text-navy">{name}</h3><p className="text-xs italic text-ink-soft">{tag}</p><p className="mt-2 text-sm text-ink-soft">{desc}</p><span className="badge-ok mt-3">{tool}</span></li>
            ))}
          </ol>
        </section>

        {/* Free trial */}
        <section id="free-trial" className="scroll-mt-20 bg-brand-tint">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-brand">FREE TRIAL</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold text-navy sm:text-4xl">Coba tes mini TOEFL ITP, gratis.</h2>
              <p className="mt-3 text-ink-soft">Format dan aturan dibuat semirip mungkin dengan tes ITP asli: timer per section, audio diputar sekali, dan tidak bisa kembali ke section sebelumnya.</p>
              <h3 className="mt-5 font-semibold text-navy">Yang kamu dapat</h3>
              <ul className="mt-2 flex flex-col gap-1 text-ink-soft">{["Estimasi skor ITP (skala 310–677)", "Skor per section & 3 kelemahan utama", "Pembahasan 5 soal", "3 pertanyaan gratis ke konselor AI"].map((x) => <li key={x}>✓ {x}</li>)}</ul>
              <Link href="/daftar" className="btn-accent mt-6 !min-h-[52px] !px-7 text-base">Mulai Free Trial</Link>
              <p className="mt-2 text-xs text-ink-soft">Satu kali per akun · siapkan headset</p>
            </div>
            <div className="table-wrap self-start">
              <table className="!min-w-0">
                <thead><tr><th>Section</th><th>Tes lengkap</th><th>Free trial</th></tr></thead>
                <tbody>
                  {[["Listening", "50 soal · ±35 mnt", "15 soal · ±12 mnt"], ["Structure & WE", "40 soal · 25 mnt", "12 soal · 8 mnt"], ["Reading", "50 soal · 55 mnt", "15 soal · ±17 mnt"]].map((r) => <tr key={r[0]}><td className="font-semibold text-navy">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Paket */}
        <section id="paket" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-brand">PAKET & HARGA</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy sm:text-4xl">Beli yang kamu butuhkan saja.</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Bayar lewat Midtrans: Virtual Account, QRIS, e-wallet, atau kartu kredit. Akses terbuka otomatis setelah pembayaran berhasil.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="card flex flex-col gap-2"><p className="text-xs font-semibold tracking-wider text-ink-soft">GRATIS</p><h3 className="font-display text-lg font-extrabold text-navy">Free Trial</h3><p className="font-display text-2xl font-extrabold text-navy">Rp0</p><p className="text-sm text-ink-soft">Kenali skormu dalam ±37 menit.</p><ul className="flex-1 text-sm text-ink-soft"><li>• Tes mini 42 soal format ITP</li><li>• Estimasi skor & 3 kelemahan</li><li>• 5 pembahasan soal</li><li>• 3 pertanyaan ke konselor AI</li></ul><Link href="/daftar" className="btn-outline">Coba gratis</Link></div>
            {products.map((p) => (
              <div key={String(p._id)} className={`card flex flex-col gap-2 ${p.highlight ? "border-2 border-brand" : ""}`}>
                <p className={`text-xs font-semibold tracking-wider ${p.highlight ? "text-brand" : "text-ink-soft"}`}>{p.highlight ? "PAKET JOURNEY · PALING LENGKAP" : p.kind === "single_sim" ? "TES SIMULASI" : p.kind === "itp_only" ? "TES RESMI" : "BUNDLE"}</p>
                <h3 className="font-display text-lg font-extrabold text-navy">{p.name}</h3>
                <p className="font-display text-2xl font-extrabold text-navy">{rp(p.price)}</p>
                <p className="text-sm text-ink-soft">{p.description}</p>
                <ul className="flex-1 text-sm text-ink-soft">{(BULLETS[p.slug] ?? []).map((b) => <li key={b}>• {b}</li>)}</ul>
                <Link href={`/paket`} className={p.highlight ? "btn-solid" : "btn-outline"}>{p.kind === "journey" ? "Ambil paket" : p.kind === "itp_only" ? "Daftar ITP" : p.kind === "bundle" ? "Pilih bundle" : "Beli tes"}</Link>
              </div>
            ))}
          </div>
        </section>

        {/* Institusi */}
        <section id="institusi" className="scroll-mt-20 bg-navy text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">INSTITUSI</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold">Kampus, instansi & perusahaan</h2>
              <p className="mt-2 text-mist">Semua paket untuk banyak peserta sekaligus.</p>
              <ul className="mt-4 flex flex-col gap-1 text-mist">{["Kode institusi & undangan massal", "Dashboard hasil kelompok", "Invoice resmi", "Jadwal ITP rombongan"].map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
            <div>
              <p className="mb-2 font-semibold">Minta penawaran</p>
              <LeadForm source="institusi" cta="Minta penawaran" dark />
            </div>
          </div>
        </section>

        {/* Untuk siapa */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-brand">UNTUK SIAPA</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy sm:text-4xl">Dirancang untuk setiap pembelajar.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map(([t, d]) => <div key={t} className="card"><h3 className="font-display text-lg font-extrabold text-navy">{t}</h3><p className="mt-1 text-sm text-ink-soft">{d}</p></div>)}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-14 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-brand">FAQ</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy">Pertanyaan yang sering muncul</h2>
          <div className="mt-6 flex flex-col gap-3">
            {faqs.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group card !p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-navy sm:p-5">{q}<span className="text-xl text-brand group-open:hidden">+</span><span className="hidden text-xl text-brand group-open:inline">−</span></summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft sm:px-5 sm:pb-5">{a}</p>
              </details>
            ))}
          </div>
          {info.supportWhatsapp && <a href={`https://wa.me/${info.supportWhatsapp.replace(/\D/g, "")}`} className="mt-5 inline-block font-semibold text-brand">Tanya via WhatsApp →</a>}
        </section>

        <section className="bg-brand-tint">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-6">
            <h2 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">Belajar bahasa Inggris seharusnya bukan tebak-tebakan.</h2>
            <p className="text-ink-soft">Mulai dari tahu skormu sekarang. Gratis, ±37 menit.</p>
            <Link href="/daftar" className="btn-accent !min-h-[52px] !px-8 text-base">Coba Free Trial</Link>
          </div>
        </section>
      </main>
      <PublicFooter email={info.supportEmail} whatsapp={info.supportWhatsapp} />
    </>
  );
}
