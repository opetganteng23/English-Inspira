import { StaffParticipantView } from "@/components/StaffParticipantView";
import { ParticipantAdminPanel } from "@/components/ParticipantAdminPanel";

// Detail peserta untuk admin: dasbor peserta di atas, semua aksi admin (jadwal, akses, attempt, akun, catatan) di bawah.
export default function Page({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col gap-6">
      <StaffParticipantView id={params.id} backHref="/admin/participants" backLabel="← Participants" reportBase={`/admin/participants/${params.id}/report`} />
      <section id="admin-actions" className="scroll-mt-16 card"><h2 className="mb-3 font-display text-lg font-extrabold text-navy">Admin actions</h2><ParticipantAdminPanel id={params.id} /></section>
    </div>
  );
}
