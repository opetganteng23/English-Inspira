import { Legal } from "@/components/Legal";
import { publicInfo } from "@/lib/public-info";

export const metadata = { title: "Kebijakan Refund — Edulyfe EPTA" };
export const dynamic = "force-dynamic";

export default async function Refund() {
  const info = await publicInfo();
  return (
    <Legal title="Kebijakan Refund">
      <h2>Produk digital</h2>
      <p>Tes simulasi dan layanan digital yang <b>sudah dipakai</b> (tes sudah dimulai atau konseling sudah berjalan) tidak dapat direfund. Jatah yang belum dipakai dapat ditinjau kasus per kasus oleh admin.</p>
      <h2>Pendaftaran TOEFL ITP resmi</h2>
      <p>{info.refundPolicy || `Perubahan jadwal dapat dilakukan sampai ${info.rescheduleDays} hari sebelum tes lewat menu Tes ITP Resmi; jatah pendaftaran dikembalikan agar kamu bisa memilih jadwal lain. Ketentuan refund biaya tes resmi mengikuti kebijakan penyelenggara dan akan diumumkan oleh admin.`}</p>
      <h2>Kegagalan teknis</h2>
      <p>Jika tes terganggu oleh kegagalan teknis dari sisi layanan, hubungi admin dengan menyertakan nomor invoice. Kami akan memulihkan jatah tes atau memproses refund sesuai hasil pemeriksaan.</p>
      <h2>Cara mengajukan</h2>
      <p>Hubungi admin lewat kontak di bawah dengan nomor invoice dan alasan. Refund yang disetujui dicatat dan akses dari pesanan tersebut dicabut.</p>
    </Legal>
  );
}
