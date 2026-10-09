import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/institution", label: "Overview" },
    { href: "/institution/participants", label: "Participants & invitations" },
    { href: "/institution/schedule", label: "Group test schedule" },
    { href: "/institution/reports", label: "Reports" },
    { href: "/institution/materials", label: "Institution materials" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["inst_admin", "admin"]} nav={nav} title="Institution portal">{children}</AppShell>;
}
