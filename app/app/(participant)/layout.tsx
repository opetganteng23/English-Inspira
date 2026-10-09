import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/beranda", label: "Home" },
    { href: "/belajar", label: "Learn" },
    { href: "/coaching", label: "Coaching" },
    { href: "/tes", label: "My Tests" },
    { href: "/hasil", label: "Test Results" },
    { href: "/unggah-hasil", label: "Upload External Results" },
    { href: "/materi", label: "Materials" },
    { href: "/konselor", label: "Konselor AI" },
    { href: "/itp", label: "Official ITP Test" },
    { href: "/sertifikat", label: "Certificates" },
  ] },
  { label: "Account", items: [
    { href: "/profil", label: "Profile" },
    { href: "/bantuan", label: "Help" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["participant", "admin"]} nav={nav}>{children}</AppShell>;
}
