/** Halaman awal tiap peran setelah masuk. Murni (tanpa impor server) agar bisa dipakai klien. */
export const roleHome = (role: string) =>
  role === "admin" || role === "academic_admin" ? "/admin" : role === "content_editor" ? "/admin/question-bank" : role === "inst_admin" ? "/institution" : role === "coach" ? "/coach" : "/home";

/** Staf pusat tidak terikat enrollment institusi. */
export const isCentralStaff = (role: string) => role === "admin" || role === "academic_admin" || role === "content_editor";
