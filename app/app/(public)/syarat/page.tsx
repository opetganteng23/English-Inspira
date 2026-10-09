import { Legal } from "@/components/Legal";

export const metadata = { title: "Syarat & Ketentuan — Edulyfe EPTA" };
export const dynamic = "force-dynamic";

export default function Syarat() {
  return (
    <Legal title="Syarat & Ketentuan">
      <h2>1. Layanan</h2>
      <p>Edulyfe EPTA menyediakan placement test, tes simulasi dan latihan format TOEFL ITP, materi belajar, analisis hasil berbasis AI, Konselor AI, sesi coaching, dan fasilitas pendaftaran tes TOEFL ITP resmi bagi peserta institusi mitra. Tes simulasi menghasilkan <b>estimasi</b> skor, bukan skor resmi. Skor dan sertifikat resmi hanya diterbitkan oleh penyelenggara tes resmi.</p>
      <h2>2. Akun</h2>
      <p>Kamu bertanggung jawab atas keamanan email yang dipakai masuk dan atas kebenaran data yang diisi. Satu akun untuk satu orang. Akun dibuat lewat undangan institusimu dan tidak ada pendaftaran mandiri. Placement test dikerjakan satu kali.</p>
      <h2>3. Akses</h2>
      <p>Akses diberikan lewat institusimu dan berlaku selama masa kontrak institusi. Setelah itu akunmu tidak bisa dipakai masuk, sedangkan datamu tetap tersimpan sesuai Kebijakan Privasi. Tidak ada pembayaran di platform ini.</p>
      <h2>4. Penggunaan yang wajar</h2>
      <p>Dilarang membagikan akun, menyalin atau menyebarkan soal dan audio, memakai alat otomatis, atau mencurangi tes. Aktivitas tes tertentu (misalnya pindah tab) dicatat dan dapat ditinjau admin.</p>
      <h2>5. Konselor AI</h2>
      <p>Konselor AI memberi saran belajar dan dapat keliru. Saran tidak menjamin skor, kelulusan, atau beasiswa. Periksa kembali persyaratan resmi instansi atau beasiswa sebelum mengambil keputusan penting.</p>
      <h2>6. Pendaftaran tes ITP resmi</h2>
      <p>Nama dan nomor identitas harus sama dengan KTP/paspor yang dibawa saat tes, dan tidak dapat diubah setelah pendaftaran dikirim. Ketentuan perubahan jadwal diumumkan oleh admin.</p>
      <h2>7. Perubahan</h2>
      <p>Ketentuan dapat diperbarui; perubahan material diberitahukan lewat email atau di aplikasi.</p>
    </Legal>
  );
}
