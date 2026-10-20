import { StaffParticipantView } from "@/components/StaffParticipantView";

export default function Page({ params }: { params: { id: string } }) {
  return <StaffParticipantView id={params.id} backHref="/admin/participants" backLabel="← Participants" reportBase={`/admin/participants/${params.id}/report`} />;
}
