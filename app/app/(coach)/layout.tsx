import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [{ items: [{ href: "/coach", label: "Peserta saya" }] }];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["coach", "admin"]} nav={nav} title="Coach">{children}</AppShell>;
}
