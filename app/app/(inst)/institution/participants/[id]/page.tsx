import { StaffParticipantView } from "@/components/StaffParticipantView";

export default function Page({ params }: { params: { id: string } }) {
  return <StaffParticipantView id={params.id} backHref="/institution/participants" backLabel="← Participants" reportBase={`/institution/participants/${params.id}/report`} />;
}
