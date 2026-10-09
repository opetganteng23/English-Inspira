import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [{ items: [{ href: "/coach", label: "Peserta saya" }, { href: "/coach/sesi", label: "Sesi & kehadiran" }, { href: "/coach/jadwal", label: "Jadwal slot" }, { href: "/coach/konselor", label: "Tinjauan Konselor AI" }] }];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["coach", "admin"]} nav={nav} title="Coach">{children}</AppShell>;
}
