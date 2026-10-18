import { z } from "zod";

// Padanan skor antartes: TOEFL ITP <-> CEFR <-> OCE/PURE.
// ITP ke CEFR memakai batas yang diterbitkan ETS untuk TOEFL ITP (A2 337, B1 460, B2 543, C1 627).
// Skala OCE/PURE diisi admin (batas minimal tiap tingkat CEFR); sampai diisi, dianggap sama dengan skala ITP.

export const CEFR = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Cefr = (typeof CEFR)[number];
export const ITP_MIN = 310, ITP_MAX = 677;
export const ITP_CEFR: Record<Exclude<Cefr, "A1">, number> = { A2: 337, B1: 460, B2: 543, C1: 627 };
export const CEFR_LABEL: Record<Cefr, string> = { A1: "A1 Beginner", A2: "A2 Elementary", B1: "B1 Intermediate", B2: "B2 Upper intermediate", C1: "C1 Advanced" };

const anchors = z.object({ A2: z.number().nullable(), B1: z.number().nullable(), B2: z.number().nullable(), C1: z.number().nullable() });
const scale = z.object({ name: z.string().trim().min(1).max(40), sameAsItp: z.boolean(), min: z.number(), max: z.number(), anchors });
export const equivalenceSchema = z.object({ oce: scale, pure: scale }).superRefine((v, ctx) => {
  for (const k of ["oce", "pure"] as const) {
    const s = v[k];
    if (s.sameAsItp) continue;
    if (!(s.max > s.min)) ctx.addIssue({ code: "custom", path: [k, "max"], message: `${s.name}: the highest score must be above the lowest` });
    const pts = (["A2", "B1", "B2", "C1"] as const).map((c) => s.anchors[c]).filter((x): x is number => x !== null);
    if (pts.length < 1) ctx.addIssue({ code: "custom", path: [k, "anchors"], message: `${s.name}: fill at least one CEFR boundary, or use the EPTA scale` });
    if (pts.some((p, i) => p <= s.min || p >= s.max || (i > 0 && p <= pts[i - 1]))) ctx.addIssue({ code: "custom", path: [k, "anchors"], message: `${s.name}: boundaries must rise from A2 to C1 and stay between ${s.min} and ${s.max}` });
  }
});
export type Equivalence = z.infer<typeof equivalenceSchema>;
export type ExternalScale = "oce" | "pure";

export const EQUIVALENCE_DEFAULT: Equivalence = {
  oce: { name: "Class test", sameAsItp: true, min: ITP_MIN, max: ITP_MAX, anchors: { A2: null, B1: null, B2: null, C1: null } },
  pure: { name: "Class test", sameAsItp: true, min: ITP_MIN, max: ITP_MAX, anchors: { A2: null, B1: null, B2: null, C1: null } },
};

export function cefrForItp(itp: number): Cefr {
  if (itp >= ITP_CEFR.C1) return "C1";
  if (itp >= ITP_CEFR.B2) return "B2";
  if (itp >= ITP_CEFR.B1) return "B1";
  if (itp >= ITP_CEFR.A2) return "A2";
  return "A1";
}

/** Titik pasangan (skor skala luar, skor ITP) dari batas CEFR yang terisi, termasuk ujung bawah dan atas. */
function points(s: Equivalence["oce"]): [number, number][] {
  const p: [number, number][] = [[s.min, ITP_MIN]];
  for (const c of ["A2", "B1", "B2", "C1"] as const) if (s.anchors[c] !== null) p.push([s.anchors[c]!, ITP_CEFR[c]]);
  p.push([s.max, ITP_MAX]);
  return p;
}
function interp(x: number, pts: [number, number][]) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}

/** Skor skala luar ke padanan ITP (dibulatkan, 310-677). */
export function toItp(score: number, from: ExternalScale, eq: Equivalence) {
  const s = eq[from];
  const v = s.sameAsItp ? score : interp(score, points(s));
  return Math.round(Math.min(ITP_MAX, Math.max(ITP_MIN, v)));
}

/** Skor ITP ke padanan skala luar. */
export function fromItp(itp: number, to: ExternalScale, eq: Equivalence) {
  const s = eq[to];
  if (s.sameAsItp) return Math.round(itp);
  const v = interp(itp, points(s).map(([a, b]) => [b, a] as [number, number]));
  return Math.round(Math.min(s.max, Math.max(s.min, v)));
}

/** Semua padanan untuk satu skor ITP: dipakai di analisis hasil dan halaman admin. */
export function equivalents(itp: number, eq: Equivalence) {
  const cefr = cefrForItp(itp);
  return {
    itp: Math.round(itp), cefr, cefrLabel: CEFR_LABEL[cefr],
    oce: { name: eq.oce.name, score: fromItp(itp, "oce", eq), estimated: !eq.oce.sameAsItp },
    pure: { name: eq.pure.name, score: fromItp(itp, "pure", eq), estimated: !eq.pure.sameAsItp },
  };
}
