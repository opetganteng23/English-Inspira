import { ResultReport } from "@/components/ResultReport";

export default function Hasil({ params }: { params: { id: string } }) {
  return <ResultReport attemptId={params.id} />;
}
