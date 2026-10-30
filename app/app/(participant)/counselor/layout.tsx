import { notFound } from "next/navigation";
import { getFeatures } from "@/lib/features";

export const dynamic = "force-dynamic"; // saklar dibaca setiap permintaan, bukan saat build

// AI Counselor dimatikan admin (Settings): halaman tidak ada.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await getFeatures()).aiCounselor) notFound();
  return children;
}
