import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [{ items: [{ href: "/coach", label: "My participants" }, { href: "/coach/sesi", label: "Sessions & attendance" }, { href: "/coach/jadwal", label: "Slot schedule" }, { href: "/coach/konselor", label: "Tinjauan Konselor AI" }, { href: "/coach/materi", label: "My materials" }] }];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["coach", "admin"]} nav={nav} title="Coach">{children}</AppShell>;
}
