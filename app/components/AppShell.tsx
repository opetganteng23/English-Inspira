import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/models/User";
import { ShellNav, type NavGroup } from "./ShellNav";
import { getFeatures } from "@/lib/features";

export type { NavGroup };
export type NavItem = { href: string; label: string };

/** Layout bersama untuk area terproteksi. Peran dicek ulang dari DB (bukan hanya token). */
export async function AppShell({
  roles, nav, title, search, children,
}: { roles: Role[]; nav: NavGroup[]; title?: string; search?: boolean; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.status === "invited") redirect("/consent");
  if (!roles.includes(user.role)) redirect("/sign-in");

  // Menu disaring di server: fitur yang dimatikan admin dan menu yang belum relevan bagi peserta tahap 1.
  const features = await getFeatures();
  const stage1 = user.role === "participant" && !user.currentLevelId;
  const shown = nav
    .map((g) => ({ ...g, items: g.items.filter((i) => (!i.feature || features[i.feature]) && !(i.afterPlacement && stage1)).map(({ href, label }) => ({ href, label })) }))
    .filter((g) => g.items.length);
  return (
    <ShellNav search={search && (user.role === "admin" || user.role === "academic_admin")} nav={shown} title={title} user={{ name: user.name ?? user.email, email: user.email, role: user.role, avatarId: user.avatarAssetId ? String(user.avatarAssetId) : null }}>
      {children}
    </ShellNav>
  );
}
