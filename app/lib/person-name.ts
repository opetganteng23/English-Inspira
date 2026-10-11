/** Nama peserta disimpan terpisah (givenName + surname); `name` = "Given Surname" dipakai untuk tampilan, email, dan PDF. */
export function composeName(givenName: string, surname: string) {
  return `${givenName} ${surname}`.replace(/\s+/g, " ").trim();
}

/** Akun lama hanya punya `name`: pisahkan token terakhir sebagai surname (bisa diperbaiki pengguna di Profil). */
export function splitName(name?: string | null) {
  const t = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (t.length < 2) return { givenName: t[0] ?? "", surname: "" };
  return { givenName: t.slice(0, -1).join(" "), surname: t[t.length - 1] };
}
