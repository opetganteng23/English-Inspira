import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/institusi", label: "Ringkasan" },
    { href: "/institusi/peserta", label: "Peserta" },
    { href: "/institusi/kode", label: "Kode & undangan" },
    { href: "/institusi/jadwal", label: "Jadwal tes rombongan" },
    { href: "/institusi/laporan", label: "Laporan" },
    { href: "/institusi/tagihan", label: "Tagihan & invoice" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["inst_admin", "admin"]} nav={nav} title="Portal institusi">{children}</AppShell>;
}
