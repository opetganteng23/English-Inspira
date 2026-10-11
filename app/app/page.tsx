import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/role-home";
import { publicInfo } from "@/lib/public-info";
import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

// Tamu melihat landing (tanpa harga/pendaftaran: akses hanya lewat institusi mitra); pengguna masuk diarahkan ke dasbornya.
export default async function Root() {
  const u = await getCurrentUser();
  if (u) {
    if (u.status === "invited") redirect("/consent");
    redirect(roleHome(u.role));
  }
  const info = await publicInfo();
  return <Landing email={info.supportEmail || undefined} whatsapp={info.supportWhatsapp || undefined} settings={info.landing} />;
}
