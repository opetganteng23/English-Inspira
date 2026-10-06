import { AppShell } from "@/components/AppShell";

const nav = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/transaksi", label: "Transaksi" },
  { href: "/admin/paket", label: "Paket & Harga" },
  { href: "/admin/peserta", label: "Peserta" },
  { href: "/admin/bank-soal", label: "Bank Soal" },
  { href: "/admin/tes", label: "Tes" },
  { href: "/admin/konselor-ai", label: "Konselor AI" },
  { href: "/admin/jadwal-itp", label: "Jadwal ITP & Skor" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["admin"]} nav={nav}>{children}</AppShell>;
}
