import Image from "next/image";
import { getMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Under maintenance | English Inspira", robots: { index: false } };

// Ditampilkan middleware (rewrite) untuk semua halaman non-admin selama mode pemeliharaan aktif.
export default async function MaintenancePage() {
  const m = await getMaintenance().catch(() => ({ message: "" }));
  return (
    <main className="theme-light flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 py-16 text-center text-white">
      <span className="rounded-2xl bg-white px-4 py-3"><Image src="/brand/ei-full.png" alt="English Inspira" width={148} height={60} priority className="h-[60px] w-auto" /></span>
      <h1 className="max-w-xl font-display text-3xl font-extrabold leading-tight sm:text-[42px]">We are doing some maintenance.</h1>
      <p className="max-w-lg text-lg leading-relaxed text-mist">{m.message || "The site is temporarily unavailable while we improve it. Please check back soon. Your data and progress are safe."}</p>
      <p className="text-sm text-[#B9CBE6]">Thank you for your patience.</p>
    </main>
  );
}
