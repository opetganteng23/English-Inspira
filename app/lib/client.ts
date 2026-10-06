// Helper fetch untuk komponen klien: lempar Error berpesan Indonesia bila respons gagal.
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { json, ...rest } = init ?? {};
  const r = await fetch(url, json !== undefined ? { ...rest, method: rest.method ?? "POST", headers: { "Content-Type": "application/json", ...rest.headers }, body: JSON.stringify(json) } : rest);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error ?? "Terjadi kesalahan"), { status: r.status });
  return d as T;
}

export const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
export const tgl = (d: string | Date, withTime = false) =>
  new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
