import { getCurrentUser } from "@/lib/auth";
import { SectionTabs } from "@/components/SectionTabs";
import { ADMIN_SECTIONS, ROLE_PAGES } from "@/lib/admin-sections";

// Satu menu, beberapa halaman sebagai tab (Sesi 4.3).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allow = user ? ROLE_PAGES[user.role] : undefined;
  return <><SectionTabs tabs={ADMIN_SECTIONS.content.filter((t) => !allow || allow.includes(t.href))} />{children}</>;
}
