import { AppShell, type NavGroup } from "@/components/AppShell";

const nav: NavGroup[] = [
  { items: [
    { href: "/admin", label: "Ringkasan" },
    { href: "/admin/peserta", label: "Peserta" },
    { href: "/admin/institusi", label: "Institusi" },
    { href: "/admin/leads", label: "Lead Free Trial" },
  ] },
  { label: "Penjualan", items: [
    { href: "/admin/transaksi", label: "Transaksi" },
    { href: "/admin/paket", label: "Paket & Harga" },
    { href: "/admin/voucher", label: "Voucher" },
  ] },
  { label: "Tes & AI", items: [
    { href: "/admin/bank-soal", label: "Bank Soal" },
    { href: "/admin/tes", label: "Tes" },
    { href: "/admin/materi", label: "Materi" },
    { href: "/admin/konselor-ai", label: "Konselor AI" },
    { href: "/admin/proctoring", label: "Review Proctoring" },
  ] },
  { label: "Operasional", items: [
    { href: "/admin/jadwal-itp", label: "Jadwal ITP & Skor" },
    { href: "/admin/pengguna", label: "Pengguna & Hak Akses" },
    { href: "/admin/pengaturan", label: "Pengaturan" },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell roles={["admin"]} nav={nav} title="Admin">{children}</AppShell>;
}
