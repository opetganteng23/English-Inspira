import { gatePage } from "@/lib/features";

export const dynamic = "force-dynamic"; // saklar dibaca setiap permintaan, bukan saat build

// Fitur "learning" dimatikan (Settings, atau modul institusi): halaman tidak ada.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await gatePage("learning");
  return children;
}
