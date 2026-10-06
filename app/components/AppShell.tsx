import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/models/User";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";

export type NavItem = { href: string; label: string };

/** Layout bersama untuk area terproteksi. Peran dicek ulang dari DB (bukan hanya token). */
export async function AppShell({
  roles, nav, children,
}: { roles: Role[]; nav: NavItem[]; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  if (!roles.includes(user.role)) redirect("/masuk");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-navy p-6 md:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-mist hover:bg-navy-700 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          <span className="text-sm text-ink-soft">{user.name ?? user.email}</span>
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
