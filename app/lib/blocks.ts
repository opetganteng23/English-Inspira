import { z } from "zod";

// Blok interaktif di rich text (MTS §10.2). Konfigurasi disimpan sebagai JSON di atribut data-config dan DIVALIDASI di server
// saat simpan dan tampil; blok dengan konfigurasi tidak sah dibuang. Setiap butir blok penilaian wajib membawa tag topik.
const t = (max = 400) => z.string().trim().min(1).max(max);

export const BLOCK_TYPES = ["quiz", "flashcard", "fill", "match", "timer", "note"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
/** Blok yang menilai jawaban dan karenanya wajib bertopik. */
export const SCORED: BlockType[] = ["quiz", "flashcard", "fill", "match"];

export const blockSchemas = {
  quiz: z.object({ items: z.array(z.object({ q: t(500), options: z.array(t(200)).min(2).max(6), answer: z.number().int().min(0).max(5) }).refine((i) => i.answer < i.options.length)).min(1).max(10) }),
  flashcard: z.object({ cards: z.array(z.object({ front: t(300), back: t(500) })).min(1).max(30) }),
  fill: z.object({ items: z.array(z.object({ text: t(500).refine((s) => s.includes("___")), answers: z.array(t(60)).min(1).max(5) })).min(1).max(10) }),
  match: z.object({ pairs: z.array(z.object({ left: t(120), right: t(120) })).min(2).max(8) }),
  timer: z.object({ minutes: z.number().int().min(1).max(60), prompt: z.string().trim().max(300).optional() }),
  note: z.object({ kind: z.enum(["catatan", "tips"]), text: t(800) }),
} as const;

export const TOPIC_RE = /^[a-z][a-z0-9 _-]{0,39}:[^:;|<>"']{1,60}$/i; // skill:topic

/** Apakah blok (tipe + JSON config + topik) sah? Dipakai sanitizer dan endpoint event. */
export function validBlock(type: string | undefined, config: string | undefined, topic: string | undefined) {
  if (!type || !(BLOCK_TYPES as readonly string[]).includes(type) || !config || config.length > 20_000) return false;
  if ((SCORED as string[]).includes(type) && !(topic && TOPIC_RE.test(topic))) return false;
  try { return blockSchemas[type as BlockType].safeParse(JSON.parse(config)).success; } catch { return false; }
}

export const parseTopic = (topic: string) => { const [skill, ...rest] = topic.split(":"); return { skill: skill.trim().toLowerCase(), topic: rest.join(":").trim() }; };

/** Ringkasan teks satu blok untuk tampilan di editor (dan cadangan bila JS mati). */
export function blockSummary(type: BlockType, cfg: unknown) {
  const c = cfg as { items?: unknown[]; cards?: unknown[]; pairs?: unknown[]; minutes?: number; kind?: string; text?: string };
  switch (type) {
    case "quiz": return `Kuis pilihan ganda · ${c.items?.length ?? 0} soal`;
    case "flashcard": return `Flashcard · ${c.cards?.length ?? 0} kartu`;
    case "fill": return `Isian · ${c.items?.length ?? 0} kalimat`;
    case "match": return `Pencocokan · ${c.pairs?.length ?? 0} pasang`;
    case "timer": return `Timer latihan · ${c.minutes ?? 0} menit`;
    case "note": return `${c.kind === "tips" ? "Tips" : "Catatan"}: ${String(c.text ?? "").slice(0, 80)}`;
  }
}

/** Nilai jawaban isian: abaikan huruf besar/kecil dan spasi di tepi. */
export const normalizeAnswer = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
