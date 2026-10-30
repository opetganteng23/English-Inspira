import { AppShell, type NavGroup } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/rbac";
import { ROLE_PAGES } from "@/lib/admin-sections";

// Menu harian di atas; alat yang jarang dipakai di "More tools" (tertutup secara default). Tidak ada halaman yang dihapus.
const nav: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overview" }] },
  { label: "People", items: [
    { href: "/admin/institutions", label: "Institutions" },
    { href: "/admin/participants", label: "People", also: ["/admin/users"] },
  ] },
  { label: "Tests & Content", items: [
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/question-bank", label: "Question Bank", also: ["/admin/audio", "/admin/media"] },
    { href: "/admin/courses", label: "Courses & Units", feature: "learning" },
    { href: "/admin/materials", label: "Materials", feature: "learning" },
  ] },
  { label: "Monitoring", items: [
    { href: "/admin/proctoring", label: "Monitoring" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/ai-counselor", label: "AI Counselor", feature: "aiCounselor" },
  ] },
  { items: [{ href: "/admin/settings", label: "Settings", also: ["/admin/parameters", "/admin/scoring"] }] },
  { label: "More tools", collapsed: true, items: [
    { href: "/admin/classes", label: "Classes" },
    { href: "/admin/external-results", label: "Class Results", feature: "externalResults" },
    { href: "/admin/coaching", label: "Coaching Monitor", feature: "coaching" },
    { href: "/admin/itp-schedule", label: "Official Test", feature: "officialTest" },
    { href: "/admin/cycles", label: "Program Cycles", feature: "programCycles" },
    { href: "/admin/data-quality", label: "Data quality" },
    { href: "/admin/emails", label: "Email log" },
    { href: "/admin/audit", label: "Audit Log" },
  ] },
];

// Menu per peran: academic_admin tanpa pengguna, parameter, pengaturan, audit; content_editor hanya soal dan audio.
const ALLOWED = ROLE_PAGES;

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allow = user ? ALLOWED[user.role] : undefined;
  // academic_admin tidak membuka Settings umum, tetapi tetap membuka Scoring profiles: menu Settings diarahkan ke sana.
  const forRole = (i: NavGroup["items"][number]) => (!allow || allow.includes(i.href) ? i : i.also?.find((h) => allow.includes(h)) ? { ...i, href: i.also.find((h) => allow.includes(h))! } : null);
  const menu = allow ? nav.map((g) => ({ ...g, items: g.items.map(forRole).filter((i): i is NavGroup["items"][number] => !!i) })).filter((g) => g.items.length) : nav;
  return <AppShell roles={STAFF_ROLES} nav={menu} search title={user?.role === "content_editor" ? "Question Editor" : user?.role === "academic_admin" ? "Academic" : "Admin"}>{children}</AppShell>;
}
