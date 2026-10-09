import Link from "next/link";
import { publicInfo } from "@/lib/public-info";

export const dynamic = "force-dynamic";

const TOPICS: [string, string][] = [
  ["Tes saya berhenti di tengah jalan", "Buka Tes Saya lalu klik Lanjutkan. Timer dipegang server dan jawaban tersimpan otomatis tiap beberapa detik, jadi refresh atau koneksi putus tidak menghilangkan jawaban."],
  ["Audio Listening tidak berbunyi", "Cek volume dan headset, lalu klik “Muat ulang audio”. Audio hanya bisa diputar sekali, tetapi muat ulang karena gagal memuat tidak dihitung sebagai pemutaran ulang."],
  ["Saya tidak bisa masuk / akses berakhir", "Akun dibuat dan dikelola institusimu. Jika pesan menyebut akses berakhir, hubungi admin institusimu karena masa akses mengikuti kontrak."],
  ["Saya tidak menerima email undangan", "Cek folder spam. Undangan berlaku 7 hari; admin institusimu dapat mengirim ulang."],
  ["Kode OTP tidak masuk", "Cek folder spam, lalu minta kode baru setelah 60 detik. Kode berlaku 5 menit dan terkunci setelah 5 kali salah."],
  ["Nama di pendaftaran ITP salah", "Nama terkunci setelah pendaftaran dikirim. Hubungi admin sebelum jadwal tes lewat kontak di bawah."],
  ["Bagaimana membatalkan atau mengganti jadwal ITP?", "Buka Tes ITP Resmi, klik “Ubah jadwal / batalkan” pada pendaftaranmu. Tersedia sampai batas hari sebelum tes."],
];

export default async function Bantuan() {
  const info = await publicInfo();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div><h1 className="page-title">Bantuan</h1><p className="mt-1 text-ink-soft">Jawaban untuk hal yang paling sering ditanyakan.</p></div>
      <div className="flex flex-col gap-3">
        {TOPICS.map(([q, a]) => (
          <details key={q} className="group card !p-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-navy">{q}<span className="text-xl text-brand group-open:hidden">+</span><span className="hidden text-xl text-brand group-open:inline">−</span></summary><p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{a}</p></details>
        ))}
      </div>
      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Masih butuh bantuan?</h2>
        <p className="mt-1 text-sm text-ink-soft">Sertakan email akunmu agar cepat ditangani.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {info.supportEmail ? <a className="btn-solid" href={`mailto:${info.supportEmail}`}>Email {info.supportEmail}</a> : null}
          {info.supportWhatsapp ? <a className="btn-outline" href={`https://wa.me/${info.supportWhatsapp.replace(/\D/g, "")}`}>WhatsApp</a> : null}
          {!info.supportEmail && !info.supportWhatsapp && <p className="text-sm text-ink-soft">Kontak admin belum diisi. Admin dapat mengisinya di Pengaturan.</p>}
        </div>
        <p className="mt-4 text-sm"><Link href="/syarat" className="text-brand">Syarat & Ketentuan</Link> · <Link href="/privasi" className="text-brand">Kebijakan Privasi</Link></p>
      </section>
    </div>
  );
}
