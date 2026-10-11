import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/home", label: "Home" },
    { href: "/learn", label: "Learn" },
    { href: "/coaching", label: "Coaching" },
    { href: "/tests", label: "My Tests" },
    { href: "/results", label: "Test Results" },
    { href: "/upload-result", label: "Upload External Results" },
    { href: "/materials", label: "Materials" },
    { href: "/counselor", label: "AI Counselor" },
    { href: "/itp", label: "Official ITP Test" },
    { href: "/certificates", label: "Certificates" },
  ] },
  { label: "Account", items: [
    { href: "/profile", label: "Profile" },
    { href: "/help", label: "Help" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["participant", "admin"]} nav={nav}>{children}</AppShell>;
}
