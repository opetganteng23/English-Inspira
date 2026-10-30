import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [{ items: [{ href: "/coach", label: "My participants" }, { href: "/coach/sessions", label: "Sessions & attendance" }, { href: "/coach/schedule", label: "Slot schedule" }, { href: "/coach/counselor", label: "AI Counselor review", feature: "aiCounselor" }] }];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["coach", "admin"]} nav={nav} title="Coach">{children}</AppShell>;
}
