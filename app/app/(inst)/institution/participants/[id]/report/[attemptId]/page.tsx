import { ResultReport } from "@/components/ResultReport";

export default function Page({ params }: { params: { id: string; attemptId: string } }) {
  return <ResultReport attemptId={params.attemptId} staffBase={`/institution/participants/${params.id}`} />;
}
