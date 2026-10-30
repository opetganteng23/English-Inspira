import { AppShell, type NavGroup } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/rbac";

// Menu harian di atas; alat yang jarang dipakai di "More tools" (tertutup secara default). Tidak ada halaman yang dihapus.
const nav: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overview" }] },
  { label: "People", items: [
    { href: "/admin/institutions", label: "Institutions" },
    { href: "/admin/participants", label: "Participants" },
    { href: "/admin/users", label: "Coaches & Admins" },
  ] },
  { label: "Tests & Content", items: [
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/question-bank", label: "Question Bank" },
    { href: "/admin/audio", label: "Audio Library" },
    { href: "/admin/media", label: "Media Library" },
    { href: "/admin/courses", label: "Courses & Units" },
    { href: "/admin/materials", label: "Materials" },
  ] },
  { label: "Monitoring", items: [
    { href: "/admin/proctoring", label: "Monitoring & Proctoring" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/ai-counselor", label: "AI Counselor", feature: "aiCounselor" },
  ] },
  { items: [{ href: "/admin/settings", label: "Settings" }] },
  { label: "More tools", collapsed: true, items: [
    { href: "/admin/classes", label: "Classes" },
    { href: "/admin/external-results", label: "Class Results" },
    { href: "/admin/coaching", label: "Coaching Monitor" },
    { href: "/admin/itp-schedule", label: "Official Test" },
    { href: "/admin/cycles", label: "Program Cycles" },
    { href: "/admin/scoring", label: "Scoring Profiles" },
    { href: "/admin/parameters", label: "System Parameters" },
    { href: "/admin/audit", label: "Audit Log" },
  ] },
];

// Menu per peran: academic_admin tanpa pengguna, parameter, pengaturan, audit; content_editor hanya soal dan audio.
const ALLOWED: Record<string, string[]> = {
  academic_admin: ["/admin", "/admin/participants", "/admin/external-results", "/admin/classes", "/admin/question-bank", "/admin/audio", "/admin/media", "/admin/tests", "/admin/courses", "/admin/materials", "/admin/scoring"],
  content_editor: ["/admin/question-bank", "/admin/audio", "/admin/media"],
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allow = user ? ALLOWED[user.role] : undefined;
  const menu = allow ? nav.map((g) => ({ ...g, items: g.items.filter((i) => allow.includes(i.href)) })).filter((g) => g.items.length) : nav;
  return <AppShell roles={STAFF_ROLES} nav={menu} search title={user?.role === "content_editor" ? "Question Editor" : user?.role === "academic_admin" ? "Academic" : "Admin"}>{children}</AppShell>;
}
