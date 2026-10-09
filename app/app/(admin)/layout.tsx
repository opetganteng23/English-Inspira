import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/admin", label: "Ringkasan" },
    { href: "/admin/institusi", label: "Institusi" },
    { href: "/admin/peserta", label: "Peserta" },
    { href: "/admin/pengguna", label: "Coach & Admin" },
  ] },
  { label: "Tes & Materi", items: [
    { href: "/admin/bank-soal", label: "Bank Soal" },
    { href: "/admin/tes", label: "Tes" },
    { href: "/admin/kursus", label: "Kursus & Unit" },
    { href: "/admin/materi", label: "Materi" },
    { href: "/admin/konselor-ai", label: "Konselor AI" },
    { href: "/admin/proctoring", label: "Review Proctoring" },
  ] },
  { label: "Operasional", items: [
    { href: "/admin/jadwal-itp", label: "Jadwal ITP & Skor" },
    { href: "/admin/parameter", label: "Parameter Sistem" },
    { href: "/admin/pengaturan", label: "Pengaturan" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["admin"]} nav={nav} title="Admin">{children}</AppShell>;
}
