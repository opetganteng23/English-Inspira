import { Legal } from "@/components/Legal";

export const metadata = { title: "Syarat & Ketentuan — Edulyfe EPTA" };
export const dynamic = "force-dynamic";

export default function Syarat() {
  return (
    <Legal title="Syarat & Ketentuan">
      <h2>1. Layanan</h2>
      <p>Edulyfe EPTA menyediakan tes simulasi format TOEFL ITP, analisis hasil berbasis AI, Konselor AI, dan fasilitas pendaftaran tes TOEFL ITP resmi. Tes simulasi menghasilkan <b>estimasi</b> skor, bukan skor resmi. Skor dan sertifikat resmi hanya diterbitkan oleh penyelenggara tes resmi.</p>
      <h2>2. Akun</h2>
      <p>Kamu bertanggung jawab atas keamanan email yang dipakai masuk dan atas kebenaran data yang diisi. Satu akun untuk satu orang. Free trial dapat dikerjakan satu kali per akun.</p>
      <h2>3. Pembelian & akses</h2>
      <p>Produk bersifat digital dan terbuka otomatis setelah pembayaran dikonfirmasi gateway pembayaran. Harga yang berlaku adalah harga saat pesanan dibuat. Akses mengikuti masa berlaku produk yang tertera.</p>
      <h2>4. Penggunaan yang wajar</h2>
      <p>Dilarang membagikan akun, menyalin atau menyebarkan soal dan audio, memakai alat otomatis, atau mencurangi tes. Aktivitas tes tertentu (misalnya pindah tab) dicatat dan dapat ditinjau admin.</p>
      <h2>5. Konselor AI</h2>
      <p>Konselor AI memberi saran belajar dan dapat keliru. Saran tidak menjamin skor, kelulusan, atau beasiswa. Periksa kembali persyaratan resmi instansi atau beasiswa sebelum mengambil keputusan penting.</p>
      <h2>6. Pendaftaran tes ITP resmi</h2>
      <p>Nama dan nomor identitas harus sama dengan KTP/paspor yang dibawa saat tes, dan tidak dapat diubah setelah pendaftaran dikirim. Ketentuan perubahan jadwal mengikuti Kebijakan Refund.</p>
      <h2>7. Perubahan</h2>
      <p>Ketentuan dapat diperbarui; perubahan material diberitahukan lewat email atau di aplikasi.</p>
    </Legal>
  );
}
