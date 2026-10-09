import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/institusi", label: "Institutions" },
    { href: "/admin/peserta", label: "Participants" },
    { href: "/admin/pengguna", label: "Coaches & Admins" },
  ] },
  { label: "Tests & Materials", items: [
    { href: "/admin/bank-soal", label: "Question Bank" },
    { href: "/admin/tes", label: "Tests" },
    { href: "/admin/kursus", label: "Kursus & Unit" },
    { href: "/admin/materi", label: "Materials" },
    { href: "/admin/konselor-ai", label: "Konselor AI" },
    { href: "/admin/proctoring", label: "Review Proctoring" },
  ] },
  { label: "Operasional", items: [
    { href: "/admin/coaching", label: "Coaching Monitor" },
    { href: "/admin/jadwal-itp", label: "ITP Schedule & Scores" },
    { href: "/admin/parameter", label: "System Parameters" },
    { href: "/admin/pengaturan", label: "Settings" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["admin"]} nav={nav} title="Admin">{children}</AppShell>;
}
