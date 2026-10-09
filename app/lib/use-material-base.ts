"use client";

import { usePathname } from "next/navigation";

/** Halaman materi dipakai bersama admin, coach, dan admin institusi. Basis rute menentukan tautan; hanya admin boleh materi HTML. */
export function useMaterialBase() {
  const p = usePathname() ?? "";
  const base = p.startsWith("/coach") ? "/coach/materi" : p.startsWith("/institusi") ? "/institusi/materi" : "/admin/materi";
  return { base, isAdmin: base === "/admin/materi" };
}
