import { getCurrentUser } from "@/lib/auth";
import { SectionTabs } from "@/components/SectionTabs";
import { ADMIN_SECTIONS, ROLE_PAGES } from "@/lib/admin-sections";

// Satu menu Settings, tiga halaman sebagai tab (Sesi 5.1).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allow = user ? ROLE_PAGES[user.role] : undefined;
  return <><SectionTabs tabs={ADMIN_SECTIONS.settings.filter((t) => !allow || allow.includes(t.href))} />{children}</>;
}
