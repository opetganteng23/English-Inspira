import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/institusi", label: "Overview" },
    { href: "/institusi/peserta", label: "Participants & invitations" },
    { href: "/institusi/jadwal", label: "Group test schedule" },
    { href: "/institusi/laporan", label: "Reports" },
    { href: "/institusi/materi", label: "Institution materials" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["inst_admin", "admin"]} nav={nav} title="Institution portal">{children}</AppShell>;
}
