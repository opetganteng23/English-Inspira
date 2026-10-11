import { AppShell, type NavGroup } from "@/components/AppShell";

// Menu atas peserta (MTS v2.4 mockup): enam tujuan utama, sisanya di "More".
const nav: NavGroup[] = [
  { items: [
    { href: "/home", label: "Home", icon: "home", primary: true },
    { href: "/learn", label: "Learn", icon: "learn", primary: true },
    { href: "/tests", label: "Tests", icon: "tests", primary: true },
    { href: "/coaching", label: "Coaching", icon: "coaching", primary: true },
    { href: "/counselor", label: "Counselor", icon: "counselor", primary: true },
    { href: "/profile", label: "Profile", icon: "profile", primary: true },
  ] },
  { label: "More", items: [
    { href: "/results", label: "Test results" },
    { href: "/materials", label: "Materials" },
    { href: "/itp", label: "Official ITP test" },
    { href: "/certificates", label: "Certificates" },
    { href: "/upload-result", label: "Upload external results" },
    { href: "/help", label: "Help" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["participant", "admin"]} nav={nav} variant="top">{children}</AppShell>;
}
