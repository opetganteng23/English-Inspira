import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/beranda", label: "Beranda" },
    { href: "/journey", label: "Journey Saya" },
    { href: "/tes", label: "Tes Saya" },
    { href: "/hasil", label: "Hasil Tes" },
    { href: "/materi", label: "Materi" },
    { href: "/konselor", label: "Konselor AI" },
    { href: "/itp", label: "Tes ITP Resmi" },
    { href: "/sertifikat", label: "Sertifikat" },
  ] },
  { label: "Belanja", items: [
    { href: "/paket", label: "Paket Tes" },
    { href: "/keranjang", label: "Keranjang" },
    { href: "/riwayat", label: "Riwayat Pembelian" },
  ] },
  { label: "Akun", items: [
    { href: "/profil", label: "Profil" },
    { href: "/bantuan", label: "Bantuan" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["participant", "admin", "inst_admin"]} nav={nav}>{children}</AppShell>;
}
