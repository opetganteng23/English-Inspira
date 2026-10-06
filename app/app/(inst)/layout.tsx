import { AppShell } from "@/components/AppShell";

const nav = [{ href: "/institusi", label: "Ringkasan" }];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["inst_admin", "admin"]} nav={nav}>{children}</AppShell>;
}
