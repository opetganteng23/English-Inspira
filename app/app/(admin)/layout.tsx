import { AppShell, type NavGroup } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/rbac";

const nav: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overview" }] },
  { label: "People & Classes", items: [
    { href: "/admin/institutions", label: "Institutions" },
    { href: "/admin/participants", label: "Participants" },
    { href: "/admin/external-results", label: "Class Results" },
    { href: "/admin/classes", label: "Classes" },
    { href: "/admin/users", label: "Coaches & Admins" },
  ] },
  { label: "Content", items: [
    { href: "/admin/question-bank", label: "Question Bank" },
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/courses", label: "Courses & Units" },
    { href: "/admin/materials", label: "Materials" },
    { href: "/admin/audio", label: "Audio Library" },
    { href: "/admin/media", label: "Media Library" },
  ] },
  { label: "Monitoring", items: [
    { href: "/admin/coaching", label: "Coaching Monitor" },
    { href: "/admin/ai-counselor", label: "AI Counselor" },
    { href: "/admin/proctoring", label: "Monitoring & Proctoring" },
    { href: "/admin/itp-schedule", label: "Official Test Schedule & Scores" },
  ] },
  { label: "System", items: [
    { href: "/admin/cycles", label: "Program Cycles" },
    { href: "/admin/scoring", label: "Scoring Profiles" },
    { href: "/admin/parameters", label: "System Parameters" },
    { href: "/admin/settings", label: "Settings" },
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
  return <AppShell roles={STAFF_ROLES} nav={menu} title={user?.role === "content_editor" ? "Question Editor" : user?.role === "academic_admin" ? "Academic" : "Admin"}>{children}</AppShell>;
}
