import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Support | English Inspira AI" };
export const dynamic = "force-dynamic";

const HOME: Record<string, string> = { participant: "/home", coach: "/coach", inst_admin: "/institution" };

// Halaman bantuan berdiri sendiri: bisa dibuka tanpa login (dari sign-in atau tautan email) maupun oleh pengguna yang login.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const back = user ? HOME[user.role] ?? "/admin" : "/sign-in";
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 sm:px-6">
        <Logo dark />
        <Link href={back} className="text-sm font-semibold text-brand">{user ? "← Back to the app" : "← Sign in"}</Link>
      </header>
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
