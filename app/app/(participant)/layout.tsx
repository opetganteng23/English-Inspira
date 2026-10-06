import { AppShell } from "@/components/AppShell";

const nav = [
  { href: "/beranda", label: "Beranda" },
  { href: "/journey", label: "Journey Saya" },
  { href: "/tes", label: "Tes Saya" },
  { href: "/konselor", label: "Konselor AI" },
  { href: "/itp", label: "Tes ITP Resmi" },
  { href: "/sertifikat", label: "Sertifikat" },
  { href: "/paket", label: "Paket Tes" },
  { href: "/profil", label: "Profil" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["participant", "admin", "inst_admin"]} nav={nav}>{children}</AppShell>;
}
