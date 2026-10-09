import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/institutions", label: "Institutions" },
    { href: "/admin/participants", label: "Participants" },
    { href: "/admin/users", label: "Coaches & Admins" },
  ] },
  { label: "Tests & Materials", items: [
    { href: "/admin/question-bank", label: "Question Bank" },
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/courses", label: "Courses & Units" },
    { href: "/admin/materials", label: "Materials" },
    { href: "/admin/ai-counselor", label: "AI Counselor" },
    { href: "/admin/proctoring", label: "Review Proctoring" },
  ] },
  { label: "Operations", items: [
    { href: "/admin/coaching", label: "Coaching Monitor" },
    { href: "/admin/itp-schedule", label: "ITP Schedule & Scores" },
    { href: "/admin/parameters", label: "System Parameters" },
    { href: "/admin/settings", label: "Settings" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["admin"]} nav={nav} title="Admin">{children}</AppShell>;
}
