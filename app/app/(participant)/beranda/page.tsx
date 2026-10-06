import { getCurrentUser } from "@/lib/auth";

export default async function Beranda() {
  const user = await getCurrentUser();
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-navy">Halo, {user?.name ?? user?.email}</h1>
      <p className="mt-2 text-ink-soft">Fondasi Fase 1 aktif. Modul tes dan hasil dibangun di Fase 2.</p>
    </div>
  );
}
