import { toast } from "@/components/Feedback";

// Permintaan latar (jawaban tes, progres, waktu aktif, obrolan, pratinjau) tidak memunculkan notifikasi "Saved".
const QUIET = /\/api\/(auth|attempts|learning|events|notifications|counselor|me\/ui-prefs|tests\/[^/]+\/start|units\/[^/]+\/quiz)|\/progress|[?&]dry=1|\/preview|\/generate|\/pick/;
function notifySaved(url: string, method: string, silent?: boolean) {
  if (silent || method === "GET" || typeof window === "undefined" || QUIET.test(url)) return;
  toast(method === "DELETE" ? "Deleted" : "Saved");
}

// Helper fetch untuk komponen klien: lempar Error berpesan Indonesia bila respons gagal.
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown; silent?: boolean }): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { json, silent, ...rest } = init ?? {};
  const r = await fetch(url, json !== undefined ? { ...rest, method: rest.method ?? "POST", headers: { "Content-Type": "application/json", ...rest.headers }, body: JSON.stringify(json) } : rest);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error ?? "Something went wrong"), { status: r.status });
  notifySaved(url, String(rest.method ?? (json !== undefined ? "POST" : "GET")).toUpperCase(), silent);
  return d as T;
}

export const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("en-GB");
export const tgl = (d: string | Date, withTime = false) =>
  new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
