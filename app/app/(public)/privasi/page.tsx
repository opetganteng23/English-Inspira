import { Legal } from "@/components/Legal";
import { publicInfo } from "@/lib/public-info";

export const metadata = { title: "Kebijakan Privasi — Edulyfe EPTA" };
export const dynamic = "force-dynamic";

export default async function Privasi() {
  const info = await publicInfo();
  return (
    <Legal title="Kebijakan Privasi">
      <h2>Data yang kami kumpulkan</h2>
      <p>Email, nama, nomor WhatsApp, target dan tujuan belajar, riwayat tes dan jawaban, percakapan dengan Konselor AI, serta data transaksi. Untuk pendaftaran tes ITP resmi: NIK/nomor paspor, tanggal lahir, jenis kelamin, foto KTP/paspor, dan pas foto.</p>
      <h2>Tujuan penggunaan</h2>
      <p>Menjalankan layanan tes dan analisis, memberi saran belajar, memproses pembayaran, mendaftarkan tes resmi, dan mengirim notifikasi layanan lewat email.</p>
      <h2>Pengamanan data sensitif</h2>
      <p>NIK dienkripsi di database. Foto identitas hanya dapat dibuka oleh pemilik dan admin yang berwenang, dan setiap akses admin dicatat. Kami tidak merekam kamera atau mikrofon saat tes; yang dicatat hanya aktivitas seperti pindah tab.</p>
      <h2>Pihak ketiga</h2>
      <p>Pembayaran diproses oleh Midtrans. Pertanyaan ke Konselor AI diproses oleh penyedia model AI; data yang dikirim dibatasi pada konteks yang diperlukan untuk menjawab. Data identitas resmi (NIK, foto) tidak dikirim ke penyedia AI.</p>
      <h2>Retensi</h2>
      <p>Dokumen identitas disimpan paling lama {info.idRetentionDays} hari setelah tes terkait selesai, kecuali hukum menentukan lain. Data transaksi disimpan sesuai kewajiban pembukuan.</p>
      <h2>Hak kamu</h2>
      <p>Kamu dapat mengunduh seluruh data pribadimu dan menghapus akun dari menu Profil. Penghapusan akun menghapus data pribadi dan mengosongkan identitas pada catatan transaksi yang wajib dipertahankan.</p>
    </Legal>
  );
}
