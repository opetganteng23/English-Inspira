import Image from "next/image";
import { getMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Under maintenance | English Inspira", robots: { index: false } };

// Ditampilkan middleware (rewrite) untuk semua halaman non-admin selama mode pemeliharaan aktif.
export default async function MaintenancePage() {
  const m = await getMaintenance().catch(() => ({ message: "" }));
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 py-16 text-center text-white">
      <Image src="/brand/logo-white.png" alt="" width={88} height={48} priority className="h-12 w-auto" />
      <p className="font-display text-lg font-extrabold tracking-wide">ENGLISH INSPIRA</p>
      <h1 className="max-w-xl font-display text-3xl font-extrabold leading-tight sm:text-[42px]">We are doing some maintenance.</h1>
      <p className="max-w-lg text-lg leading-relaxed text-mist">{m.message || "The site is temporarily unavailable while we improve it. Please check back soon. Your data and progress are safe."}</p>
      <p className="text-sm text-[#B9CBE6]">Thank you for your patience.</p>
    </main>
  );
}
