import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/institusi", label: "Ringkasan" },
    { href: "/institusi/peserta", label: "Peserta & undangan" },
    { href: "/institusi/jadwal", label: "Jadwal tes rombongan" },
    { href: "/institusi/laporan", label: "Laporan" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["inst_admin", "admin"]} nav={nav} title="Portal institusi">{children}</AppShell>;
}
