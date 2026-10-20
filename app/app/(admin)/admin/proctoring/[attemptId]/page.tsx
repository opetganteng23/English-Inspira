import { ActivityTimeline } from "@/components/ActivityTimeline";

export default function Page({ params }: { params: { attemptId: string } }) {
  return <ActivityTimeline attemptId={params.attemptId} back={{ href: "/admin/proctoring", label: "← Review Proctoring" }} />;
}
