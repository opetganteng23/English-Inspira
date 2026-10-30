import { gatePage } from "@/lib/features";

export const dynamic = "force-dynamic"; // saklar dibaca setiap permintaan, bukan saat build

// Fitur "coaching" dimatikan (Settings, atau modul institusi): halaman tidak ada.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await gatePage("coaching");
  return children;
}
