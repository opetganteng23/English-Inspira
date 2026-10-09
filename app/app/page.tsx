import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Tidak ada landing/pendaftaran publik (MTS v2.2): hanya peserta yang diundang institusi mitra.
export default async function Root() {
  const u = await getCurrentUser();
  if (!u) redirect("/masuk");
  if (u.status === "invited") redirect("/persetujuan");
  redirect(u.role === "admin" ? "/admin" : u.role === "inst_admin" ? "/institusi" : u.role === "coach" ? "/coach" : "/beranda");
}
