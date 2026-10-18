import Image from "next/image";
import { getMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Under maintenance | English Inspira AI", robots: { index: false } };

// Ditampilkan middleware (rewrite) untuk semua halaman non-admin selama mode pemeliharaan aktif.
export default async function MaintenancePage() {
  const m = await getMaintenance().catch(() => ({ message: "" }));
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 py-16 text-center text-white">
      <span className="rounded-2xl bg-white px-4 py-2"><Image src="/brand/logo.png" alt="English Inspira AI" width={1600} height={550} priority className="h-16 w-auto" /></span>
      <h1 className="max-w-xl font-display text-3xl font-extrabold leading-tight sm:text-[42px]">We are doing some maintenance.</h1>
      <p className="max-w-lg text-lg leading-relaxed text-mist">{m.message || "The site is temporarily unavailable while we improve it. Please check back soon. Your data and progress are safe."}</p>
      <p className="text-sm text-[#B9CBE6]">Thank you for your patience.</p>
    </main>
  );
}
