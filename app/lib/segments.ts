import { collectTestRows } from "./test-export";
import { AGE_GROUPS, ageOf, ageGroupOf } from "./age";
import { coordsOf } from "./branches";
import { isLearningTopic } from "./topics";

type Row = NonNullable<Awaited<ReturnType<typeof collectTestRows>>>["rows"][number];
export type Dim = "overall" | "age" | "branch" | "province" | "date";
export const DIMS: { key: Dim; label: string }[] = [
  { key: "overall", label: "Overall" }, { key: "age", label: "Age group" }, { key: "branch", label: "Branch" }, { key: "province", label: "Province" }, { key: "date", label: "Test date" },
];

/** Kunci & label kelompok satu baris untuk dimensi tertentu ("" = tidak masuk kelompok mana pun). */
export function groupOf(r: Row, dim: Dim): { key: string; label: string; order: number } {
  if (dim === "overall") return { key: "all", label: "All participants", order: 0 };
  if (dim === "age") { const g = ageGroupOf(ageOf(r.birthDate)); return g ? { key: g.key, label: g.label, order: AGE_GROUPS.findIndex((x) => x.key === g.key) } : { key: "", label: "Unknown", order: 99 }; }
  if (dim === "branch") return r.branch ? { key: r.branch, label: r.branch, order: 0 } : { key: "", label: "Unknown", order: 99 };
  if (dim === "province") return r.province ? { key: r.province, label: r.province, order: 0 } : { key: "", label: "Unknown", order: 99 };
  return r.scheduledDay ? { key: r.scheduledDay, label: r.scheduledDay, order: r._sort } : { key: "", label: "Not scheduled", order: Number.MAX_SAFE_INTEGER };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number");
const SEC = { grammar: "Structure", structure: "Structure", listening: "Listening", reading: "Reading" } as Record<string, string>;

export type Segment = {
  key: string; label: string; order: number; scheduled: number; finished: number; absent: number;
  avg: number | null; median: number | null; min: number | null; max: number | null; atTarget: number; pctTarget: number | null;
  levels: Record<string, number>; sections: { listening: number | null; structure: number | null; reading: number | null };
  weakTopic: { name: string; section: string; pct: number } | null; avgAge: number | null; lat: number | null; lng: number | null;
};

/** Ringkasan per kelompok: kehadiran, skor, % ≥ target, sebaran level, rata-rata bagian, topik terlemah. */
export function segment(rows: Row[], dim: Dim, levels: { name: string }[], target = 550): Segment[] {
  const m = new Map<string, { g: ReturnType<typeof groupOf>; rs: Row[] }>();
  for (const r of rows) { const g = groupOf(r, dim); const e = m.get(g.key) ?? { g, rs: [] }; e.rs.push(r); m.set(g.key, e); }
  return [...m.values()].map(({ g, rs }) => {
    const fin = rs.filter((r) => r.status === "Finished" && typeof r.score === "number"), sc = fin.map((r) => r.score!).sort((a, b) => a - b);
    const lv: Record<string, number> = {}; for (const l of levels) lv[l.name] = fin.filter((r) => r.level === l.name).length;
    const t = new Map<string, { skill: string; topic: string; c: number; n: number }>();
    for (const r of fin) for (const x of r.topics) {
      if (!x.total || !isLearningTopic(x) || /^part-[abc]$/.test(x.topic)) continue;
      const k = `${x.skill}|${x.topic}`, a = t.get(k) ?? { skill: x.skill, topic: x.topic, c: 0, n: 0 }; a.c += x.correct; a.n += x.total; t.set(k, a);
    }
    const weak = [...t.values()].filter((a) => fin.length && a.n / fin.length >= 2).sort((a, b) => a.c / a.n - b.c / b.n)[0];
    const at = sc.filter((x) => x >= target).length;
    const ages = nums(rs.map((r) => ageOf(r.birthDate)));
    const c = dim === "branch" && g.key ? coordsOf(g.key) : null;
    return {
      key: g.key, label: g.label, order: g.order, scheduled: rs.length, finished: fin.length, absent: rs.filter((r) => r.attendance === "Absent").length,
      avg: mean(sc), median: sc.length ? (sc.length % 2 ? sc[(sc.length - 1) / 2] : (sc[sc.length / 2 - 1] + sc[sc.length / 2]) / 2) : null, min: sc[0] ?? null, max: sc[sc.length - 1] ?? null,
      atTarget: at, pctTarget: fin.length ? (at / fin.length) * 100 : null, levels: lv,
      sections: { listening: mean(nums(fin.map((r) => r.listening))), structure: mean(nums(fin.map((r) => r.structure))), reading: mean(nums(fin.map((r) => r.reading))) },
      weakTopic: weak ? { name: weak.topic.replace(/-/g, " "), section: SEC[weak.skill] ?? weak.skill, pct: (weak.c / weak.n) * 100 } : null,
      avgAge: mean(ages), lat: c?.lat ?? null, lng: c?.lng ?? null,
    };
  }).sort((a, b) => a.order - b.order || (b.finished - a.finished) || a.label.localeCompare(b.label));
}

/** Data analisis satu tes (opsional dibatasi ke satu institusi) untuk dimensi terpilih. */
export async function testSegments(testId: string, dim: Dim, opts: { institutionId?: string; target?: number; releasedOnly?: boolean } = {}) {
  const got = await collectTestRows(testId);
  if (!got) return null;
  let rows = got.rows.filter((r) => !r.qa && (!opts.institutionId || r.instId === opts.institutionId));
  // Admin institusi: hasil yang masih ditahan/menunggu jam rilis tidak dihitung (jumlahnya tetap diberitahukan).
  const held = opts.releasedOnly ? rows.filter((r) => r.status === "Finished" && r.released.startsWith("At")).length : 0;
  if (opts.releasedOnly) rows = rows.map((r) => (r.status === "Finished" && r.released.startsWith("At") ? { ...r, score: null, level: "", listening: null, structure: null, reading: null, topics: [] } : r));
  const levels = [...got.levels].sort((a, b) => a.order - b.order).map((l) => ({ name: l.name }));
  return { test: { id: String(got.test._id), name: got.test.name }, levels: levels.map((l) => l.name), target: opts.target ?? 550, held, segments: segment(rows, dim, levels, opts.target), overall: segment(rows, "overall", levels, opts.target)[0] ?? null };
}
