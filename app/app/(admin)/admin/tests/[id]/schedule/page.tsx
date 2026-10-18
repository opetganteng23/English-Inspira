import { ScheduleBoard } from "@/components/ScheduleBoard";

export default function JadwalTes({ params }: { params: { id: string } }) {
  return <ScheduleBoard testId={params.id} />;
}
