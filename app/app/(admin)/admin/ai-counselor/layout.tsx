import { notFound } from "next/navigation";
import { getFeatures } from "@/lib/features";

// AI Counselor dimatikan admin (Settings): halaman tidak ada.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await getFeatures()).aiCounselor) notFound();
  return children;
}
