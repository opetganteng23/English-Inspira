import { AppShell, type NavGroup } from "@/components/AppShell";

// Peserta tahap 1 (belum ada hasil placement dirilis) hanya melihat Home, My Tests, Test Results, Profile, FAQ.
const nav: NavGroup[] = [
  { items: [
    { href: "/home", label: "Home" },
    { href: "/learn", label: "Learn", feature: "learning", afterPlacement: true },
    { href: "/coaching", label: "Coaching", feature: "coaching", afterPlacement: true },
    { href: "/tests", label: "My Tests" },
    { href: "/results", label: "Test Results" },
    { href: "/upload-result", label: "Upload External Results", feature: "externalResults", afterPlacement: true },
    { href: "/materials", label: "Materials", feature: "learning", afterPlacement: true },
    { href: "/counselor", label: "AI Counselor", feature: "aiCounselor", afterPlacement: true },
    { href: "/itp", label: "Official EPTA Test", feature: "officialTest", afterPlacement: true },
    { href: "/certificates", label: "Certificates", feature: "certificates", afterPlacement: true },
  ] },
  { label: "Account", items: [
    { href: "/profile", label: "Profile" },
    { href: "/help", label: "FAQ" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["participant", "admin"]} nav={nav}>{children}</AppShell>;
}
