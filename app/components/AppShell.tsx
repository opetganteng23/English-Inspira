import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/models/User";
import { ShellNav, type NavGroup } from "./ShellNav";

export type { NavGroup };
export type NavItem = { href: string; label: string };

/** Layout bersama untuk area terproteksi. Peran dicek ulang dari DB (bukan hanya token). */
export async function AppShell({
  roles, nav, title, children,
}: { roles: Role[]; nav: NavGroup[]; title?: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  if (!roles.includes(user.role)) redirect("/masuk");

  return (
    <ShellNav nav={nav} title={title} user={{ name: user.name ?? user.email, email: user.email, role: user.role }}>
      {children}
    </ShellNav>
  );
}
