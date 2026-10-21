import { readFileSync } from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import { collectTestRows, type ReportScope } from "./test-export";
import { TestSeat, TestSession } from "@/models/Schedule";
import { User } from "@/models/User";
import { isLearningTopic } from "./topics";
import { segment } from "./segments";
import { AGE_GROUPS } from "./age";

type Row = NonNullable<Awaited<ReturnType<typeof collectTestRows>>>["rows"][number];
type Slide = PptxGenJS.Slide;
type Sec = "listening" | "structure" | "reading";

// Palet dan tipografi mengikuti laporan Hari 1 AirNav yang disusun manual (960 x 540 pt).
const C = { cloud: "F8FAFD", navy: "0B2A5B", ink: "14213D", soft: "5B6577", card: "EEF3FB", line: "D6DEEA", blue: "0D4FA8", orange: "F28C28", green: "2E9E6B", red: "C2412D", sky: "1E9BE0", mid: "4F86CF", peach: "F7B77A", cream: "FFF1E0", white: "FFFFFF" };
const FONT = "Calibri";
const X = (px: number) => px / 96; // koordinat diukur dari render 1280 x 720 px
const ASSET = path.join(process.cwd(), "lib", "report-assets");
const img = (f: string) => `image/png;base64,${readFileSync(path.join(ASSET, f)).toString("base64")}`;
const LOGO = { inspira: 2.894, ailo: 1.041, nit: 2.953 }; // rasio lebar/tinggi

const ID = (n: number, d = 0) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const P = (a: number, b: number) => `${ID(b ? (a / b) * 100 : 0, 1)}%`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = (xs: number[]) => { const m = mean(xs); return xs.length ? Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) : 0; };
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number");
const TGL = (d: Date, day = true) => new Date(d).toLocaleDateString("id-ID", { ...(day ? { weekday: "long" as const } : {}), day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const HARI: Record<string, string> = { Mon: "Senin", Tue: "Selasa", Wed: "Rabu", Thu: "Kamis", Fri: "Jumat", Sat: "Sabtu", Sun: "Minggu", May: "Mei", Aug: "Agu", Oct: "Okt", Dec: "Des" };
const hari = (d: string) => d.replace(/[A-Z][a-z]{2}/g, (w) => HARI[w] ?? w);
const SEC: Record<Sec, string> = { listening: "Listening", structure: "Structure & Written Expression", reading: "Reading" };
const SHORT: Record<Sec, string> = { listening: "Listening", structure: "Structure", reading: "Reading" };
const KEYS: Sec[] = ["listening", "structure", "reading"];
// Nama tampilan topik soal (tag di bank soal). Topik yang belum dipetakan ditampilkan dari slug-nya.
const TOPIC: Record<string, string> = {
  "infinitive-gerund": "Gerund & infinitive", inversion: "Inversion", "reduced-clause": "Reduced clause", cleft: "Cleft sentence", "verb-form": "Verb form & tenses",
  "adj-clause": "Adjective clause", parallelism: "Parallel structure", "plural-noun": "Singular & plural noun", "noun-adverb-clause": "Noun & adverb clause",
  "sv-agreement": "Subject–verb agreement", redundancy: "Redundancy", "paired-conj": "Paired conjunction", pronoun: "Pronoun", "subject-verb": "Subject & verb",
  "word-form": "Word form", comparison: "Comparison", article: "Article", conjunction: "Conjunction", preposition: "Preposition", tense: "Tenses", tenses: "Tenses",
  "main-idea": "Main idea", detail: "Detail", "phrasal-verb": "Phrasal verb", reason: "Reason", agreement: "Agreement & disagreement", implication: "Implication",
  purpose: "Purpose", idiom: "Idiom", inference: "Inference", suggestion: "Suggestion", conditional: "Conditional", restatement: "Restatement", negative: "Negative expression",
  "negative-fact": "Negative fact (NOT/EXCEPT)", reference: "Reference", vocabulary: "Vocabulary", attitude: "Author’s attitude",
};
const SKILL: Record<string, string> = { grammar: "Structure", structure: "Structure", listening: "Listening", reading: "Reading" };
const topicName = (t: string) => TOPIC[t] ?? t.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
type TopicAgg = { key: string; name: string; section: string; pct: number; perPerson: number; weak: number; people: number };
/** Rekap per topik dari skor topik tiap peserta: % benar, rata-rata soal per orang, dan jumlah peserta yang benar < 50%. */
function topicAgg(rs: Row[]): TopicAgg[] {
  const m = new Map<string, { skill: string; topic: string; c: number; n: number; people: number; weak: number }>();
  for (const r of rs) for (const t of r.topics) {
    if (!t.total || !isLearningTopic(t) || /^part-[abc]$/.test(t.topic)) continue;
    const k = `${t.skill}|${t.topic}`, a = m.get(k) ?? { skill: t.skill, topic: t.topic, c: 0, n: 0, people: 0, weak: 0 };
    a.c += t.correct; a.n += t.total; a.people++; if (t.correct / t.total < 0.5) a.weak++;
    m.set(k, a);
  }
  return [...m.entries()].map(([key, a]) => ({ key, name: topicName(a.topic), section: SKILL[a.skill] ?? a.skill, pct: (a.c / a.n) * 100, perPerson: a.n / a.people, weak: a.weak, people: a.people }))
    .filter((x) => x.perPerson >= 2) // topik dengan 1 soal per orang terlalu sempit untuk disimpulkan
    .sort((x, y) => x.pct - y.pct);
}
type PersonTopic = { name: string; section: string; pct: number; n: number };
/** Kekuatan dan kelemahan satu peserta: topik dengan minimal 2 soal, diurutkan % benar (seri: soal lebih banyak lebih bermakna). */
function personal(r: Row) {
  const list: PersonTopic[] = r.topics
    .filter((t) => t.total >= 2 && isLearningTopic(t) && !/^part-[abc]$/.test(t.topic))
    .map((t) => ({ name: topicName(t.topic), section: SKILL[t.skill] ?? t.skill, pct: (t.correct / t.total) * 100, n: t.total }));
  const strong = [...list].sort((a, b) => b.pct - a.pct || b.n - a.n).filter((t) => t.pct >= 60).slice(0, 2);
  const weak = [...list].sort((a, b) => a.pct - b.pct || b.n - a.n).filter((t) => t.pct < 60).slice(0, 2);
  return { strong, weak };
}
const fmtTopics = (ts: PersonTopic[]) => ts.map((t) => `${t.name} (${Math.round((t.pct * t.n) / 100)}/${t.n} benar)`).join(", ");
const title = (s: string) => s.replace(/\S+/g, (w) => (w.length > 2 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w));

/**
 * Executive summary (.pptx) satu tes: per sesi/hari (sessionId) atau keseluruhan.
 * Struktur, tata letak, ikon, dan logo mengikuti laporan Placement Test Hari 1 AirNav. Akun QA tidak dihitung.
 */
export async function buildExecSummary(testId: string, opts: { sessionId?: string; target?: number; now?: Date; scope?: ReportScope; groups?: string } = {}) {
  const now = opts.now ?? new Date(), target = opts.target ?? 550;
  const got = await collectTestRows(testId, now, opts.sessionId, opts.scope ?? {});
  if (!got) return null;
  const { test, sessions, levels } = got;
  const perDay = !!opts.sessionId;
  const sess = perDay ? sessions[0] : null;
  const rows = got.rows.filter((r) => !r.qa);
  const fin = rows.filter((r) => r.status === "Finished" && typeof r.score === "number");
  const scores = fin.map((r) => r.score!);
  const insts = [...new Set(rows.map((r) => r.institution).filter(Boolean))];
  const inst = insts.length === 1 ? insts[0] : "";
  const totalQ = test.sections.reduce((n, s) => n + s.questionIds.length, 0);
  const limitMin = Math.round(test.sections.reduce((n, s) => n + (s.durationSec ?? 0), 0) / 60);

  // Peserta yang dipindah keluar dari sesi ini (dicatat sejak fitur pindah menyimpan sesi asal).
  const movedSeats = sess ? await TestSeat.find({ testId, "movedFrom.sessionId": sess._id, sessionId: { $ne: sess._id } }).select("userId").lean() : [];
  const movedUsers = movedSeats.length ? await User.find({ _id: { $in: movedSeats.map((x) => x.userId) }, qaTester: { $ne: true } }).select("name status").lean() : [];
  const moved = movedUsers.map((u) => ({ name: u.name ?? "", active: u.status === "active" }));

  // Semua sesi tes (untuk "sesi berikutnya"), bukan hanya sesi laporan ini.
  const allSess = perDay ? await TestSession.find({ testId }).sort({ opensAt: 1 }).lean() : sessions;
  const sc = opts.scope ?? {};
  const scopeExtra = [sc.branch, sc.age ? `Usia ${AGE_GROUPS.find((g) => g.key === sc.age)?.label ?? sc.age}` : ""].filter(Boolean).join(" · ");
  const scopeLabel = [sess ? sess.label : "Keseluruhan", scopeExtra].filter(Boolean).join(" · ");
  const footerText = `Laporan ${test.name} · ${scopeLabel}${inst ? ` · ${inst}` : ""}`;

  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  p.author = "English Inspira AI";
  p.company = "PT Nusa Inspira Teknologi";
  p.title = `Laporan ${test.name} – ${scopeLabel}`;
  p.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const L = { inspira: img("logo-inspira.png"), ailo: img("logo-ailo.png"), nit: img("logo-nit.png") };
  const icon = (n: string) => img(`icon-${n}.png`);
  const T = (s: Slide, text: string | PptxGenJS.TextProps[], o: PptxGenJS.TextPropsOptions) => s.addText(text as never, { fontFace: FONT, color: C.ink, margin: 0, valign: "top", ...o });
  const box = (s: Slide, x: number, y: number, w: number, h: number, fill: string, r = 0.12) => s.addShape(p.ShapeType.roundRect, { x: X(x), y: X(y), w: X(w), h: X(h), fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: r });
  const dot = (s: Slide, x: number, y: number, d: number, fill: string, ic: string) => {
    s.addShape(p.ShapeType.ellipse, { x: X(x), y: X(y), w: X(d), h: X(d), fill: { color: fill }, line: { color: fill, width: 0 } });
    s.addImage({ data: icon(ic), x: X(x + d * 0.27), y: X(y + d * 0.27), w: X(d * 0.46), h: X(d * 0.46) });
  };
  const partners = (s: Slide, x: number, y: number, h: number) => {
    s.addImage({ data: L.ailo, x: X(x), y: X(y), w: X(h * LOGO.ailo), h: X(h) });
    s.addImage({ data: L.nit, x: X(x + h * LOGO.ailo + 14), y: X(y + h * 0.15), w: X(h * 0.7 * LOGO.nit), h: X(h * 0.7) });
  };
  // Footer di slide master: logo tersimpan sekali untuk seluruh slide (ukuran file tetap kecil).
  p.defineSlideMaster({
    title: "CONTENT", background: { color: C.cloud },
    objects: [
      { image: { data: L.inspira, x: X(58), y: X(664), w: X(30 * LOGO.inspira), h: X(30) } },
      { text: { text: footerText, options: { x: X(158), y: X(670), w: X(760), h: X(22), fontFace: FONT, fontSize: 9, color: C.ink, valign: "middle", margin: 0 } } },
      { image: { data: L.ailo, x: X(1180 - 30 * LOGO.nit - 12 - 44 * LOGO.ailo), y: X(654), w: X(44 * LOGO.ailo), h: X(44) } },
      { image: { data: L.nit, x: X(1180 - 30 * LOGO.nit), y: X(661), w: X(30 * LOGO.nit), h: X(30) } },
    ],
    slideNumber: { x: X(1186), y: X(670), w: X(50), h: X(22), fontFace: FONT, fontSize: 9, color: C.soft, align: "right" },
  });
  const base = (head: string, sub: string) => {
    const s = p.addSlide({ masterName: "CONTENT" });
    T(s, head, { x: X(58), y: X(44), w: X(1160), h: X(56), fontSize: 30, bold: true, color: C.navy, valign: "middle" });
    T(s, sub, { x: X(58), y: X(103), w: X(1160), h: X(26), fontSize: 13, color: C.blue, valign: "middle" });
    return s;
  };
  const darkNote = (s: Slide, x: number, y: number, w: number, h: number, parts: PptxGenJS.TextProps[], ic?: string) => {
    box(s, x, y, w, h, C.navy);
    if (ic) dot(s, x + 24, y + h / 2 - 30, 60, C.orange, ic);
    T(s, parts, { x: X(x + (ic ? 100 : 24)), y: X(y + 16), w: X(w - (ic ? 124 : 48)), h: X(h - 32), fontSize: 13, color: C.white, valign: "middle" });
  };
  const tableHead = (cols: string[], size = 11, align: PptxGenJS.HAlign[] = []) => cols.map((t, i) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: size, align: align[i] ?? "left" } }));

  // ================= 1. Sampul =================
  {
    const s = p.addSlide();
    s.background = { data: img("bg-cover.png") }; // lingkaran sudah terpotong di gambar: aman di viewer yang tidak memotong objek di luar slide
    s.addImage({ data: L.inspira, x: X(67), y: X(70), w: X(118 * LOGO.inspira), h: X(118) });
    T(s, `LAPORAN UNTUK ${(inst || "institusi").toUpperCase()}`, { x: X(67), y: X(244), w: X(1000), h: X(24), fontSize: 12, bold: true, color: C.orange, charSpacing: 3 });
    T(s, `Hasil ${test.name}`, { x: X(67), y: X(292), w: X(1000), h: X(60), fontSize: 34, bold: true, color: C.navy });
    T(s, perDay ? scopeLabel : allSess.length ? `Keseluruhan · ${TGL(allSess[0].opensAt, false)} – ${TGL(allSess[allSess.length - 1].opensAt, false)}` : "Keseluruhan", { x: X(67), y: X(355), w: X(1000), h: X(60), fontSize: 34, bold: true, color: C.orange });
    T(s, `Program English Inspira AI · ${ID(fin.length)} peserta menyelesaikan tes${fin.length ? ` · rata-rata skor ${ID(Math.round(mean(scores)))}` : ""}`, { x: X(67), y: X(457), w: X(1000), h: X(26), fontSize: 14, color: C.ink });
    T(s, `Data diekspor dari English Inspira AI pada ${now.toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`, { x: X(67), y: X(510), w: X(1000), h: X(20), fontSize: 10, italic: true, color: C.soft });
    s.addShape(p.ShapeType.line, { x: X(67), y: X(588), w: X(440), h: 0, line: { color: C.line, width: 1 } });
    T(s, "Dikembangkan oleh", { x: X(67), y: X(630), w: X(110), h: X(20), fontSize: 9, color: C.soft, valign: "middle" });
    partners(s, 180, 606, 70);
  }

  if (!fin.length) {
    const s = base("Belum ada hasil", "Belum ada peserta yang menyelesaikan tes pada cakupan laporan ini.");
    box(s, 58, 168, 400, 150, C.card);
    T(s, ID(rows.length), { x: X(82), y: X(188), w: X(350), h: X(60), fontSize: 40, bold: true, color: C.navy });
    T(s, "Peserta terjadwal", { x: X(82), y: X(255), w: X(350), h: X(30), fontSize: 16, bold: true, color: C.navy });
    return { buffer: Buffer.from((await p.stream({ compression: true })) as Uint8Array), name: perDay ? `${test.name} - ${scopeLabel}` : test.name };
  }

  // ---- Angka bersama
  const present = rows.filter((r) => r.attendance === "Present").length;
  const absentRows = rows.filter((r) => r.attendance === "Absent");
  const pendingRows = rows.filter((r) => r.attendance !== "Present" && r.attendance !== "Absent");
  const inProgress = rows.filter((r) => r.status === "In progress");
  const above = scores.filter((x) => x >= target).length;
  const near = scores.filter((x) => x >= target - 50 && x < target).length;
  const lv = [...levels].sort((a, b) => a.order - b.order).map((l) => ({ l, rs: fin.filter((r) => r.level === l.name) }));
  const secAvg = (rs: Row[], k: Sec) => mean(nums(rs.map((r) => r[k])));
  const avgs = KEYS.map((k) => secAvg(fin, k));
  const weakest = KEYS[avgs.indexOf(Math.min(...avgs))], strongest = KEYS[avgs.indexOf(Math.max(...avgs))];
  // bagian terendah per peserta (seri dihitung terpisah)
  const lowest = { listening: 0, structure: 0, reading: 0, tie: 0 };
  for (const r of fin) {
    const v = KEYS.map((k) => r[k]);
    if (v.some((x) => typeof x !== "number")) continue;
    const m = Math.min(...(v as number[])), at = KEYS.filter((_, i) => v[i] === m);
    if (at.length > 1) lowest.tie++; else lowest[at[0]]++;
  }
  const weakCount = Math.max(lowest.listening, lowest.structure, lowest.reading);
  const weakPer = (KEYS.find((k) => lowest[k] === weakCount) ?? weakest) as Sec;

  // ================= 2. Ringkasan eksekutif =================
  {
    const s = base("Ringkasan eksekutif", `Gambaran umum hasil ${test.name} ${perDay ? scopeLabel : "seluruh sesi"}`);
    const attended = present + absentRows.length;
    const top = [...lv].sort((a, b) => b.rs.length - a.rs.length)[0];
    const cards: [string, string, string, string][] = [
      [P(present, attended || 1).replace(",0%", "%"), "Tingkat kehadiran", `${ID(fin.length)} peserta hadir dan selesai${moved.length ? `; ${ID(moved.length)} peserta pindah jadwal` : absentRows.length ? `; ${ID(absentRows.length)} tidak hadir` : ""}${!perDay && pendingRows.length ? `; ${ID(pendingRows.length)} belum tiba jadwalnya` : ""}`, C.orange],
      [ID(Math.round(mean(scores))), "Rata-rata skor", `Median ${ID(median(scores))} · rentang ${Math.min(...scores)}–${Math.max(...scores)}`, C.navy],
      [ID(above), `Peserta ≥ ${target}`, `${P(above, fin.length)} peserta sudah mencapai target; ${ID(scores.filter((x) => x >= 600).length)} di antaranya ≥ 600`, C.green],
      [ID(top.rs.length), `Level ${top.l.name}`, lv.filter((x) => x !== top).reverse().map((x) => `${x.l.name} ${ID(x.rs.length)}`).join(" · ") + " peserta", C.navy],
    ];
    cards.forEach(([big, label, note, col], i) => {
      const x = 58 + i * 295, dark = i === 0;
      box(s, x, 163, 279, 202, dark ? C.navy : C.card);
      T(s, big, { x: X(x + 28), y: X(188), w: X(230), h: X(56), fontSize: 36, bold: true, color: col });
      T(s, label, { x: X(x + 28), y: X(262), w: X(230), h: X(28), fontSize: 15, bold: true, color: dark ? C.white : C.navy });
      T(s, note, { x: X(x + 28), y: X(300), w: X(230), h: X(50), fontSize: 11.5, color: dark ? "DCE6F5" : C.soft });
    });
    T(s, "Temuan utama", { x: X(58), y: X(390), w: X(400), h: X(28), fontSize: 16, bold: true, color: C.navy });
    const share = above / fin.length;
    const finds: [string, string, string][] = [
      ["star", C.green, `${share >= 0.5 ? "Lebih dari separuh" : share >= 0.45 ? "Hampir separuh" : "Sebanyak"} peserta (${P(above, fin.length)}) sudah berada di skor ≥ ${target} sejak tes penempatan.`],
      ["target", C.orange, `${ID(near)} peserta berada di rentang ${target - 50}–${target - 1}: kelompok terdekat ke target ${target}.`],
      ["layers", C.red, `${SEC[weakPer]} menjadi bagian terlemah bagi ${ID(weakCount)} peserta (${P(weakCount, fin.length)}).`],
      ["bell", C.blue, moved.length ? `${ID(moved.length)} peserta pindah jadwal atas permintaan perubahan${moved.some((m) => !m.active) ? `; ${ID(moved.filter((m) => !m.active).length)} di antaranya perlu aktivasi akun` : ""}.`
        : absentRows.length ? `${ID(absentRows.length)} peserta tidak hadir pada jadwalnya dan perlu dijadwalkan ulang.`
        : pendingRows.length ? `${ID(pendingRows.length)} peserta ${perDay ? "belum menyelesaikan tes pada sesi ini" : "masih dijadwalkan pada sesi berikutnya"}.`
        : "Seluruh peserta terjadwal hadir dan menyelesaikan tes."],
    ];
    finds.forEach(([ic, col, t], i) => {
      const x = 58 + (i % 2) * 590, y = 437 + Math.floor(i / 2) * 103;
      box(s, x, y, 572, 92, C.card);
      dot(s, x + 21, y + 19, 54, col, ic);
      T(s, t, { x: X(x + 91), y: X(y + 12), w: X(460), h: X(68), fontSize: 13, color: C.ink, valign: "middle" });
    });
  }

  // ================= 3. Kehadiran =================
  {
    const s = base("Kehadiran dan penyelesaian tes", perDay
      ? (absentRows.length || pendingRows.length ? `${ID(fin.length)} dari ${ID(rows.length)} peserta terjadwal hadir dan menyelesaikan tes` : `Seluruh peserta yang mengikuti jadwal hari ini hadir dan menyelesaikan tes (${ID(fin.length)} dari ${ID(rows.length)})`)
      : `${ID(fin.length)} dari ${ID(rows.length)} peserta terjadwal sudah menyelesaikan tes (${P(fin.length, rows.length)})`);
    const stack: [string, string, string, string][] = perDay ? [
      [ID(rows.length + moved.length), "Tercatat di sistem", `Peserta terdaftar pada ${sess ? TGL(sess.opensAt, false) : "sesi ini"}`, C.navy],
      [ID(fin.length), "Hadir & selesai", `${P(fin.length, rows.length).replace(",0%", "%")} dari peserta yang tetap mengikuti jadwal hari ini`, C.green],
      moved.length ? [ID(moved.length), "Pindah jadwal", "Atas permintaan perubahan jadwal, bukan ketidakhadiran", C.orange]
        : [ID(absentRows.length + inProgress.length), "Tidak hadir / belum selesai", absentRows.length + inProgress.length ? "Lihat daftar di sebelah kanan" : "Tidak ada peserta yang tertinggal", absentRows.length ? C.red : C.orange],
    ] : [
      [ID(rows.length), "Terjadwal", `Di ${ID(allSess.length)} sesi`, C.navy],
      [ID(fin.length), "Hadir & selesai", `${P(fin.length, rows.length)} dari seluruh peserta terjadwal`, C.green],
      [ID(pendingRows.length + absentRows.length), "Belum / tidak hadir", `${ID(absentRows.length)} tidak hadir · ${ID(pendingRows.length)} belum tiba jadwalnya atau sedang tes`, C.orange],
    ];
    stack.forEach(([n, t, d, col], i) => {
      const y = 168 + i * 154;
      box(s, 58, y, 442, 135, C.card);
      s.addShape(p.ShapeType.roundRect, { x: X(58), y: X(y), w: X(14), h: X(135), fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.08 });
      T(s, n, { x: X(88), y: X(y + 30), w: X(140), h: X(75), fontSize: n.length > 4 ? 32 : 40, bold: true, color: col, valign: "middle" });
      T(s, t, { x: X(235), y: X(y + 24), w: X(250), h: X(28), fontSize: 16, bold: true, color: C.navy });
      T(s, d, { x: X(235), y: X(y + 64), w: X(250), h: X(50), fontSize: 11.5, color: C.soft });
    });
    if (perDay) {
      const list = [
        ...moved.map((m) => ({ name: m.name, why: "Perubahan jadwal", active: m.active })),
        ...absentRows.map((r) => ({ name: r.name, why: "Tidak hadir", active: r.account === "Active" })),
        ...inProgress.map((r) => ({ name: r.name, why: "Belum selesai", active: r.account === "Active" })),
      ];
      const headTxt = moved.length && !absentRows.length && !inProgress.length ? "Peserta yang pindah jadwal" : "Peserta yang perlu ditindaklanjuti";
      T(s, headTxt, { x: X(538), y: X(165), w: X(682), h: X(28), fontSize: 16, bold: true, color: C.navy });
      if (list.length) {
        const shown = list.slice(0, 5);
        const body = shown.map((m, i) => [
          { text: String(i + 1), options: { align: "center" as const } }, { text: title(m.name) }, { text: m.why },
          { text: m.active ? "Akun aktif" : "Belum aktivasi", options: { color: m.active ? C.ink : C.red } },
        ].map((c) => ({ ...c, options: { ...(c.options ?? {}), fill: { color: i % 2 ? C.card : C.white } } })));
        s.addTable([tableHead(["No", "Nama peserta", "Keterangan", "Status akun"], 11, ["center"]), ...body], { x: X(538), y: X(212), w: X(682), colW: [X(57), X(298), X(173), X(154)], rowH: X(44), fontFace: FONT, fontSize: 11.5, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.02, 0.1, 0.02, 0.1] });
        if (list.length > 5) T(s, `+${ID(list.length - 5)} peserta lainnya; daftar lengkap ada di ekspor Excel (sheet Attendance).`, { x: X(538), y: X(212 + 44 * 6 + 4), w: X(682), h: X(18), fontSize: 10, italic: true, color: C.soft });
      } else {
        box(s, 538, 212, 682, 120, C.card);
        T(s, "Tidak ada peserta yang perlu ditindaklanjuti: seluruh peserta terjadwal hadir dan menyelesaikan tes.", { x: X(562), y: X(222), w: X(634), h: X(100), fontSize: 13, color: C.ink, valign: "middle" });
      }
      const inactive = list.filter((m) => !m.active).length;
      darkNote(s, 538, 499, 682, 135, [
        { text: "Tindak lanjut yang disarankan: ", options: { bold: true, color: C.orange } },
        { text: list.length ? `pastikan ${moved.length ? `${ID(moved.length)} peserta yang pindah jadwal mengikuti tes pada tanggal barunya` : `${ID(list.length)} peserta di atas dijadwalkan ulang`}${inactive ? `, dan ${ID(inactive)} peserta yang belum mengaktifkan akun segera melakukan aktivasi sebelum jadwal tersebut` : ""}.` : "tidak ada; laporan hari ini lengkap." },
      ], "info");
    } else {
      T(s, "Rekap per hari", { x: X(538), y: X(165), w: X(682), h: X(28), fontSize: 16, bold: true, color: C.navy });
      const days = [...new Set(rows.map((r) => r.scheduledDay || "Tanpa jadwal"))];
      const body = days.map((d, i) => {
        const rs = rows.filter((r) => (r.scheduledDay || "Tanpa jadwal") === d), f = rs.filter((r) => r.status === "Finished" && r.score != null);
        return [hari(d), ID(rs.length), ID(f.length), ID(rs.filter((r) => r.attendance === "Absent").length), f.length ? ID(Math.round(mean(f.map((r) => r.score!)))) : "-"].map((t, j) => ({ text: t, options: { align: (j ? "center" : "left") as PptxGenJS.HAlign, fill: { color: i % 2 ? C.card : C.white } } }));
      });
      const rh = Math.min(30, 300 / (body.length + 1));
      s.addTable([tableHead(["Hari", "Terjadwal", "Selesai", "Tidak hadir", "Rata-rata"], 10.5, ["left", "center", "center", "center", "center"]), ...body], { x: X(538), y: X(205), w: X(682), colW: [X(222), X(115), X(115), X(115), X(115)], rowH: X(rh), fontFace: FONT, fontSize: rh < 24 ? 9.5 : 10.5, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.02, 0.1, 0.02, 0.1] });
      darkNote(s, 538, 528, 682, 106, [
        { text: "Catatan: ", options: { bold: true, color: C.orange } },
        { text: pendingRows.length ? `${ID(pendingRows.length)} peserta masih menunggu jadwal atau sedang tes. Unduh ulang laporan ini setelah sesi terakhir untuk angka final.` : "Seluruh sesi telah selesai; angka pada laporan ini sudah final." },
      ], "info");
    }
  }

  // ================= 4. Sebaran skor =================
  {
    const s = base("Sebaran skor total peserta", `Skor estimasi pada skala 310–677; batang biru tua menandai peserta yang sudah mencapai ${target}`);
    const lo = Math.floor(Math.min(...scores) / 25) * 25, hi = Math.floor(Math.max(...scores) / 25) * 25;
    const labels: string[] = [], below: number[] = [], over: number[] = [];
    for (let b = lo; b <= hi; b += 25) {
      labels.push(`${b}–${b === hi && b + 24 >= 670 ? 677 : b + 24}`);
      const n = scores.filter((x) => x >= b && x < b + 25).length;
      below.push(b >= target ? 0 : n);
      over.push(b >= target ? n : 0);
    }
    s.addChart(p.ChartType.bar, [{ name: `Di bawah ${target}`, labels, values: below }, { name: `${target} ke atas`, labels, values: over }], {
      x: X(58), y: X(160), w: X(820), h: X(470), barDir: "col", barGrouping: "stacked", barGapWidthPct: 25, chartColors: ["9CB8E0", C.blue],
      showLegend: true, legendPos: "t", legendFontFace: FONT, legendFontSize: 10, showValue: true, dataLabelPosition: "inEnd", dataLabelColor: C.white, dataLabelFontFace: FONT, dataLabelFontSize: 10, dataLabelFormatCode: "0;;;",
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelColor: C.soft, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9, valAxisLabelColor: C.soft,
      valGridLine: { color: "E6EBF2", size: 0.5 }, catAxisLineShow: false, valAxisLineShow: false,
      showValAxisTitle: true, valAxisTitle: "Jumlah peserta", valAxisTitleFontSize: 10, valAxisTitleColor: C.soft, showCatAxisTitle: true, catAxisTitle: "Rentang skor total", catAxisTitleFontSize: 10, catAxisTitleColor: C.soft,
    });
    box(s, 912, 163, 308, 336, C.card);
    ([["Rata-rata", ID(mean(scores), 1)], ["Median", ID(median(scores))], ["Skor tertinggi", ID(Math.max(...scores))], ["Skor terendah", ID(Math.min(...scores))], ["Simpangan baku", ID(sd(scores), 1)]] as const).forEach(([k, v], i) => {
      T(s, k, { x: X(936), y: X(185 + i * 63), w: X(150), h: X(40), fontSize: 13, color: C.ink, valign: "middle" });
      T(s, v, { x: X(1060), y: X(185 + i * 63), w: X(140), h: X(40), fontSize: 22, bold: true, color: C.navy, align: "right", valign: "middle" });
    });
    darkNote(s, 912, 518, 308, 126, [{ text: `${Math.abs(mean(scores) - target) <= 15 ? `Sebaran cukup merata di sekitar ${target}: ` : ""}${ID(near)} peserta berada tepat di bawah target (${target - 50}–${target - 1}).` }]);
  }

  // ================= 5. Posisi terhadap target =================
  {
    const s = base(`Posisi peserta terhadap target ${target}`, "Pengelompokan berdasarkan jarak skor ke target program");
    const g = [
      { k: "≥ 600", n: scores.filter((x) => x >= Math.max(600, target)).length, t: "Melampaui target", d: "Siap diarahkan ke 600-an dan level lanjutan.", col: C.navy, fg: C.white },
      { k: `${target}–599`, n: scores.filter((x) => x >= target && x < 600).length, t: "Sudah mencapai target", d: "Pertahankan dan tingkatkan stabilitas skor.", col: C.mid, fg: C.white },
      { k: `${target - 50}–${target - 1}`, n: near, t: "Mendekati target", d: "Kurang 1–50 poin; kelompok paling cepat naik.", col: C.peach, fg: C.ink },
      { k: `${target - 90}–${target - 51}`, n: scores.filter((x) => x >= target - 90 && x < target - 50).length, t: "Perlu penguatan", d: "Kurang 51–90 poin; latihan terarah per bagian.", col: C.orange, fg: C.white },
      { k: `< ${target - 90}`, n: scores.filter((x) => x < target - 90).length, t: "Perlu fondasi", d: "Kurang lebih dari 90 poin; mulai dari dasar.", col: C.red, fg: C.white },
    ];
    const W = 1159, minW = 70, total = fin.length;
    const raw = g.map((x) => (x.n ? Math.max(minW, (x.n / total) * W) : 0)), scale = W / raw.reduce((a, b) => a + b, 0);
    let x = 58, lineX = 58;
    g.forEach((it, i) => {
      const w = raw[i] * scale;
      if (w) {
        s.addShape(p.ShapeType.rect, { x: X(x), y: X(205), w: X(w - 2), h: X(93), fill: { color: it.col }, line: { color: it.col, width: 0 } });
        T(s, [{ text: ID(it.n), options: { fontSize: 20, bold: true, breakLine: true } }, { text: P(it.n, total), options: { fontSize: 11 } }], { x: X(x), y: X(215), w: X(w - 2), h: X(72), color: it.fg, align: "center", valign: "middle" });
        x += w;
      }
      if (i === 1) lineX = x;
    });
    s.addShape(p.ShapeType.line, { x: X(lineX - 1), y: X(185), w: 0, h: X(133), line: { color: C.ink, width: 3 } });
    T(s, `Target ${target}`, { x: X(lineX - 80), y: X(156), w: X(160), h: X(22), fontSize: 11, bold: true, color: C.ink, align: "center", valign: "middle" });
    T(s, `${ID(above)} peserta (${P(above, total)}) di atas garis target`, { x: X(58), y: X(306), w: X(560), h: X(22), fontSize: 11, bold: true, color: C.blue });
    T(s, `${ID(total - above)} peserta (${P(total - above, total)}) di bawah garis target`, { x: X(660), y: X(306), w: X(560), h: X(22), fontSize: 11, bold: true, color: C.red, align: "right" });
    g.forEach((it, i) => {
      const cx = 58 + i * 235;
      box(s, cx, 365, 221, 273, C.card);
      box(s, cx + 24, 389, 87, 36, it.col, 0.5);
      T(s, it.k, { x: X(cx + 24), y: X(389), w: X(87), h: X(36), fontSize: 10, bold: true, color: it.fg, align: "center", valign: "middle" });
      T(s, `${ID(it.n)} peserta`, { x: X(cx + 24), y: X(437), w: X(190), h: X(34), fontSize: 20, bold: true, color: C.navy, valign: "middle" });
      T(s, it.t, { x: X(cx + 24), y: X(478), w: X(190), h: X(26), fontSize: 13, bold: true, color: C.navy, valign: "middle" });
      T(s, it.d, { x: X(cx + 24), y: X(518), w: X(180), h: X(60), fontSize: 11, color: C.soft });
    });
  }

  // ================= 6. Level dan CEFR =================
  {
    const s = base("Penempatan level dan kesetaraan CEFR", "Level ini menjadi dasar pengelompokan kelas pada tahap pembelajaran");
    const cols = [C.sky, C.blue, C.navy];
    lv.slice(0, 3).forEach(({ l, rs }, i) => {
      const y = 168 + i * 158.5;
      box(s, 58, y, 585, 140, C.card);
      box(s, 58, y, 192, 140, cols[i] ?? C.navy);
      T(s, [{ text: ID(rs.length), options: { fontSize: 32, bold: true, breakLine: true } }, { text: P(rs.length, fin.length), options: { fontSize: 11 } }], { x: X(58), y: X(y + 20), w: X(192), h: X(100), color: C.white, align: "center", valign: "middle" });
      T(s, l.name, { x: X(274), y: X(y + 18), w: X(350), h: X(30), fontSize: 18, bold: true, color: C.navy, valign: "middle" });
      T(s, `Rentang skor ${l.scoreMin}–${l.scoreMax}${rs.length ? ` · rata-rata ${ID(mean(rs.map((r) => r.score!)), 1)}` : ""}`, { x: X(274), y: X(y + 60), w: X(350), h: X(24), fontSize: 12, color: C.soft, valign: "middle" });
      T(s, rs.length ? `Listening ${ID(secAvg(rs, "listening"), 1)} · Structure ${ID(secAvg(rs, "structure"), 1)} · Reading ${ID(secAvg(rs, "reading"), 1)}` : "Belum ada peserta", { x: X(274), y: X(y + 92), w: X(350), h: X(24), fontSize: 11, color: C.soft, valign: "middle" });
    });
    T(s, "Kesetaraan CEFR", { x: X(672), y: X(160), w: X(400), h: X(24), fontSize: 14, bold: true, color: C.navy });
    const cefr = ["A1", "A2", "B1", "B2", "C1"].filter((k) => fin.some((r) => r.cefr === k));
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: cefr, values: cefr.map((k) => fin.filter((r) => r.cefr === k).length) }], {
      x: X(672), y: X(190), w: X(548), h: X(375), barDir: "col", barGapWidthPct: 45, chartColors: [C.blue], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 12,
      valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 12, catAxisLabelColor: C.ink, catAxisLineShow: false,
    });
    T(s, "A2 dasar · B1 menengah · B2 menengah atas · C1 mahir. Kesetaraan bersifat estimasi.", { x: X(672), y: X(572), w: X(548), h: X(20), fontSize: 10, italic: true, color: C.soft });
  }

  // ================= 7. Kemampuan per bagian =================
  {
    const s = base("Kemampuan per bagian tes", `Skor bagian pada skala 31–68: ${SHORT[strongest]} paling kuat, ${SHORT[weakest]} paling perlu dikuatkan`);
    T(s, "Rata-rata skor per bagian", { x: X(58), y: X(160), w: X(557), h: X(24), fontSize: 14, bold: true, color: C.navy });
    const colors = [C.blue, C.orange, C.green];
    KEYS.forEach((k, i) => {
      const y = 206 + i * 144;
      box(s, 58, y, 557, 125, C.card);
      T(s, SEC[k], { x: X(82), y: X(y + 14), w: X(380), h: X(26), fontSize: 14, bold: true, color: C.navy, valign: "middle" });
      T(s, ID(avgs[i], 1), { x: X(450), y: X(y + 10), w: X(145), h: X(44), fontSize: 26, bold: true, color: C.navy, align: "right", valign: "middle" });
      box(s, 82, y + 79, 509, 18, C.line, 0.5);
      box(s, 82, y + 79, Math.max(18, (509 * (avgs[i] - 31)) / 37), 18, colors[i], 0.5);
    });
    T(s, "Posisi pada skala 31 (kiri) hingga 68 (kanan)", { x: X(58), y: X(632), w: X(557), h: X(20), fontSize: 10, italic: true, color: C.soft });
    T(s, "Bagian dengan skor terendah per peserta", { x: X(662), y: X(160), w: X(558), h: X(24), fontSize: 14, bold: true, color: C.navy });
    const bars = [...KEYS.map((k) => ({ l: SHORT[k], n: lowest[k] })).sort((a, b) => b.n - a.n), { l: "Dua bagian seri", n: lowest.tie }];
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: [...bars].reverse().map((b) => b.l), values: [...bars].reverse().map((b) => b.n) }], {
      x: X(662), y: X(200), w: X(558), h: X(280), barDir: "bar", barGapWidthPct: 40, chartColors: [C.orange], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 11,
      valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 10, catAxisLabelColor: C.soft, catAxisLineShow: false,
    });
    darkNote(s, 662, 499, 558, 139, [
      { text: `${ID(weakCount)} dari ${ID(fin.length)} peserta (${P(weakCount, fin.length)})`, options: { bold: true, color: C.orange } },
      { text: ` memiliki skor terendah di ${SEC[weakPer]}. Bagian ini menjadi prioritas materi bersama untuk seluruh kelompok.` },
    ]);
  }

  // ================= 7b. Kekuatan dan kelemahan per topik =================
  const topics = topicAgg(fin);
  if (topics.length >= 4) {
    const s = base("Kekuatan dan kelemahan per topik", "Persentase jawaban benar per topik soal, dari seluruh jawaban peserta yang menyelesaikan tes");
    const n = Math.min(6, Math.floor(topics.length / 2));
    const weak = topics.slice(0, n), strong = topics.slice(-n).reverse();
    const col = (x: number, head: string, list: TopicAgg[], color: string, weakSide: boolean) => {
      T(s, head, { x: X(x), y: X(160), w: X(560), h: X(24), fontSize: 14, bold: true, color: C.navy });
      list.forEach((t, i) => {
        const y = 196 + i * 70;
        box(s, x, y, 572, 60, C.card);
        T(s, [{ text: t.name, options: { bold: true, color: C.navy, fontSize: 13 } }, { text: `   ${t.section}`, options: { color: C.soft, fontSize: 10 } }], { x: X(x + 18), y: X(y + 7), w: X(420), h: X(22), valign: "middle" });
        T(s, `${ID(t.pct, 0)}%`, { x: X(x + 450), y: X(y + 5), w: X(104), h: X(28), fontSize: 20, bold: true, color, align: "right", valign: "middle" });
        box(s, x + 18, y + 38, 300, 10, C.line, 0.5);
        box(s, x + 18, y + 38, Math.max(8, 3 * t.pct), 10, color, 0.5);
        T(s, weakSide ? `${ID(t.weak)} peserta (${P(t.weak, t.people)}) benar < 50%` : `${ID(t.people - t.weak)} peserta (${P(t.people - t.weak, t.people)}) benar ≥ 50%`, { x: X(x + 330), y: X(y + 34), w: X(224), h: X(18), fontSize: 9.5, color: C.soft, align: "right", valign: "middle" });
      });
    };
    col(58, "Topik paling lemah", weak, C.red, true);
    col(648, "Topik paling kuat", strong, C.green, false);
    const w0 = weak[0];
    T(s, [{ text: "Cara membaca: ", options: { bold: true, color: C.orange } }, { text: `soal ${w0.name} (${w0.section}) hanya dijawab benar ${ID(w0.pct, 0)}%, dan ${ID(w0.weak)} peserta menjawab benar kurang dari separuh soal topik ini. Topik seperti ini layak menjadi materi awal di kelas.` }], { x: X(58), y: X(618), w: X(1162), h: X(36), fontSize: 11, color: C.ink, valign: "middle" });
  }

  // ================= 7c. Kelemahan per level =================
  if (topics.length >= 4) {
    const s = base("Kelemahan utama per level", "Topik dengan persentase benar terendah di tiap level, sebagai dasar materi kelas pada tahap pembelajaran");
    const icons: [string, string][] = [["sprout", C.sky], ["layers", C.blue], ["rocket", C.navy]];
    const examples: string[] = [];
    lv.slice(0, 3).forEach(({ l, rs }, i) => {
      const x = 58 + i * 393.5;
      box(s, x, 160, 370, 362, C.card);
      dot(s, x + 22, 178, 54, icons[i][1], icons[i][0]);
      T(s, [{ text: l.name, options: { bold: true, fontSize: 16, color: C.navy, breakLine: true } }, { text: `${ID(rs.length)} peserta · 5 topik terlemah`, options: { fontSize: 10.5, color: C.soft } }], { x: X(x + 90), y: X(180), w: X(260), h: X(50), valign: "middle" });
      const tl = topicAgg(rs).slice(0, 5);
      if (!tl.length) { T(s, "Belum ada peserta di level ini.", { x: X(x + 22), y: X(250), w: X(320), h: X(24), fontSize: 12, color: C.soft }); return; }
      tl.forEach((t, j) => {
        const y = 248 + j * 53;
        T(s, [{ text: t.name, options: { bold: true, fontSize: 12, color: C.ink, breakLine: true } }, { text: t.section, options: { fontSize: 9.5, color: C.soft } }], { x: X(x + 22), y: X(y), w: X(250), h: X(42), valign: "middle" });
        T(s, `${ID(t.pct, 0)}%`, { x: X(x + 270), y: X(y), w: X(80), h: X(42), fontSize: 18, bold: true, color: t.pct < 50 ? C.red : t.pct < 65 ? C.orange : C.green, align: "right", valign: "middle" });
      });
      examples.push(`${l.name} lemah di ${tl.slice(0, 2).map((t) => `${t.name} (${ID(t.pct, 0)}%)`).join(" dan ")}`);
    });
    darkNote(s, 58, 540, 1162, 98, [{ text: "Contoh hasil: ", options: { bold: true, color: C.orange } }, { text: `${examples.join("; ")}. Persentase adalah jawaban benar dari seluruh soal topik tersebut pada level itu.` }]);
  }

  // ================= 8. Profil per level =================
  {
    const s = base("Profil kemampuan per level", "Rata-rata skor tiap bagian untuk masing-masing level penempatan");
    const used = lv.filter((x) => x.rs.length);
    s.addChart(p.ChartType.bar, KEYS.map((k, i) => ({ name: ["Listening", "Structure & WE", "Reading"][i], labels: used.map((x) => x.l.name), values: used.map((x) => Math.round(secAvg(x.rs, k) * 10) / 10) })), {
      x: X(58), y: X(160), w: X(730), h: X(480), barDir: "col", barGapWidthPct: 40, chartColors: [C.blue, C.orange, C.green], showLegend: true, legendPos: "t", legendFontFace: FONT, legendFontSize: 11,
      showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 10, dataLabelFormatCode: "0.0", valAxisMinVal: 30, valAxisMaxVal: 70, valAxisMajorUnit: 10,
      valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9, valAxisLabelColor: C.soft, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 12, catAxisLabelColor: C.soft, valGridLine: { color: "E6EBF2", size: 0.5 }, catAxisLineShow: false, valAxisLineShow: false,
      showValAxisTitle: true, valAxisTitle: "Skor bagian (skala 31–68)", valAxisTitleFontSize: 10, valAxisTitleColor: C.soft,
    });
    const icons: [string, string][] = [["sprout", C.sky], ["layers", C.blue], ["rocket", C.navy]];
    lv.slice(0, 3).forEach(({ l, rs }, i) => {
      const y = 168 + i * 158.5;
      box(s, 816, y, 404, 145, C.card);
      dot(s, 835, y + 19, 54, icons[i][1], icons[i][0]);
      T(s, l.name, { x: X(902), y: X(y + 18), w: X(300), h: X(26), fontSize: 15, bold: true, color: C.navy, valign: "middle" });
      let t = "Belum ada peserta di level ini.";
      if (rs.length) {
        const a = KEYS.map((k) => secAvg(rs, k)), lo = KEYS[a.indexOf(Math.min(...a))], hi = KEYS[a.indexOf(Math.max(...a))], avg = ID(mean(rs.map((r) => r.score!)), 1);
        t = i === 0 ? `Rata-rata ${avg}. ${Math.max(...a) < 50 ? `Ketiga bagian masih di bawah ${Math.ceil(Math.max(...a))}` : `${SHORT[lo]} paling rendah (${ID(Math.min(...a), 1)})`}; perlu penguatan fondasi grammar dan kosakata.`
          : i === lv.length - 1 ? `Rata-rata ${avg}. ${SHORT[hi]} sudah kuat (${ID(Math.max(...a), 1)}); ${KEYS.filter((k) => k !== hi).map((k) => SHORT[k]).join(" dan ")} menjadi kunci menuju 600-an.`
          : `Rata-rata ${avg}. ${SHORT[lo]} (${ID(Math.min(...a), 1)}) menjadi pembeda utama untuk naik ke ${target}.`;
      }
      T(s, t, { x: X(902), y: X(y + 50), w: X(300), h: X(80), fontSize: 11, color: C.ink });
    });
  }

  // ================= 8b. Perbandingan per kelompok umur dan per cabang =================
  {
    const lvNames = lv.map((x) => ({ name: x.l.name }));
    const fmtTopic = (t: { name: string; pct: number } | null) => (t ? `${topicName(t.name.replace(/ /g, "-"))} ${ID(t.pct, 0)}%` : "-");
    const ages = segment(rows, "age", lvNames, target).filter((g) => g.key && g.finished);
    if (ages.length >= 2 && !sc.age) {
      const s = base("Perbandingan per kelompok umur", "Rata-rata skor, pencapaian target, dan kemampuan per bagian di tiap kelompok umur");
      const best = [...ages].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0], worst = [...ages].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
      s.addChart(p.ChartType.bar, [{ name: "Rata-rata skor", labels: ages.map((g) => g.label), values: ages.map((g) => Math.round(g.avg ?? 0)) }], {
        x: X(58), y: X(160), w: X(470), h: X(360), barDir: "col", barGapWidthPct: 40, chartColors: [C.blue], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 11,
        valAxisMinVal: 400, valAxisMaxVal: 620, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: C.ink, catAxisLineShow: false,
        showTitle: true, title: "Rata-rata skor per kelompok umur", titleFontFace: FONT, titleFontSize: 12, titleColor: C.navy,
      });
      const body = ages.map((g, i) => [g.label, ID(g.finished), ID(Math.round(g.avg ?? 0)), g.pctTarget != null ? `${ID(g.pctTarget, 1)}%` : "-", ID(g.sections.listening ?? 0, 1), ID(g.sections.structure ?? 0, 1), ID(g.sections.reading ?? 0, 1), fmtTopic(g.weakTopic)].map((t, j) => ({ text: t, options: { align: (j === 0 || j === 7 ? "left" : "center") as PptxGenJS.HAlign, bold: j === 2, fontSize: j === 7 ? 9.5 : 11, fill: { color: i % 2 ? C.card : C.white } } })));
      s.addTable([tableHead(["Usia", "Selesai", "Rata-rata", `≥ ${target}`, "L", "S", "R", "Topik terlemah"], 10.5, ["left", "center", "center", "center", "center", "center", "center", "left"]), ...body], { x: X(548), y: X(165), w: X(672), colW: [X(70), X(64), X(76), X(72), X(48), X(48), X(48), X(246)], rowH: X(Math.min(40, 340 / (body.length + 1))), fontFace: FONT, fontSize: 11, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.02, 0.08, 0.02, 0.08] });
      darkNote(s, 58, 540, 1162, 98, [{ text: "Temuan: ", options: { bold: true, color: C.orange } }, { text: `kelompok usia ${best.label} memiliki rata-rata tertinggi (${ID(Math.round(best.avg ?? 0))}, ${ID(best.pctTarget ?? 0, 1)}% ≥ ${target}), sedangkan ${worst.label} terendah (${ID(Math.round(worst.avg ?? 0))}). Selisih ${ID(Math.round((best.avg ?? 0) - (worst.avg ?? 0)))} poin dapat menjadi dasar penyesuaian pendampingan per kelompok umur.` }], "info");
    }
    const brs = segment(rows, "branch", lvNames, target).filter((g) => g.key && g.finished).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    if (brs.length >= 2 && !sc.branch) {
      const s = base("Perbandingan per cabang", `${ID(brs.length)} cabang/unit, diurutkan dari rata-rata skor tertinggi`);
      const PER = Math.ceil(Math.min(brs.length, 36) / 2), cols = [brs.slice(0, PER), brs.slice(PER, 36)];
      const rh = Math.min(26, 360 / (PER + 1));
      cols.forEach((list, half) => {
        if (!list.length) return;
        const body = list.map((g, i) => [String(half * PER + i + 1), g.label.replace(/^Cabang (Pembantu )?/i, ""), ID(g.finished), ID(Math.round(g.avg ?? 0)), g.pctTarget != null ? `${ID(g.pctTarget, 0)}%` : "-", fmtTopic(g.weakTopic)].map((t, j) => ({
          text: t, options: { align: (j === 1 || j === 5 ? "left" : "center") as PptxGenJS.HAlign, bold: j === 3, color: j === 3 ? ((g.avg ?? 0) >= target ? C.green : (g.avg ?? 0) >= target - 50 ? C.orange : C.red) : C.ink, fontSize: j === 5 ? 8 : 9.5, fill: { color: i % 2 ? C.card : C.white } },
        })));
        s.addTable([tableHead(["#", "Cabang", "Selesai", "Rata-rata", `≥ ${target}`, "Topik terlemah"], 9, ["center", "left", "center", "center", "center", "left"]), ...body], { x: X(58 + half * 590), y: X(150), w: X(572), colW: [X(30), X(165), X(60), X(70), X(57), X(190)], rowH: X(rh), fontFace: FONT, fontSize: 9.5, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.5 }, margin: [0, 0.06, 0, 0.06] });
      });
      const top = brs[0], low = brs[brs.length - 1], big = [...brs].sort((a, b) => b.finished - a.finished)[0];
      darkNote(s, 58, 150 + rh * (PER + 1) + 12, 1162, Math.max(80, 640 - (150 + rh * (PER + 1) + 12)), [{ text: "Temuan: ", options: { bold: true, color: C.orange } }, { text: `${top.label} tertinggi (rata-rata ${ID(Math.round(top.avg ?? 0))}), ${low.label} terendah (${ID(Math.round(low.avg ?? 0))}). Cabang dengan peserta terbanyak: ${big.label} (${ID(big.finished)} peserta, rata-rata ${ID(Math.round(big.avg ?? 0))}). Peta sebaran per cabang tersedia di menu Analytics.` }], "info");
    }
  }

  // ================= 9. Pola pengerjaan =================
  {
    const s = base("Pola pengerjaan tes", "Kapan peserta mengerjakan, berapa lama, dan seberapa lengkap jawabannya");
    T(s, "Waktu mulai tes (WIB)", { x: X(58), y: X(160), w: X(615), h: X(24), fontSize: 14, bold: true, color: C.navy });
    const hours = fin.map((r) => (r.startedAt ? Number(new Date(r.startedAt).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })) % 24 : -1)).filter((h) => h >= 0);
    const slots = [["00.00–07.59", 0, 8], ["08.00–11.59", 8, 12], ["12.00–17.59", 12, 18], ["18.00–23.59", 18, 24]] as const;
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: slots.map((x) => x[0]), values: slots.map(([, a, b]) => hours.filter((h) => h >= a && h < b).length) }], {
      x: X(58), y: X(195), w: X(615), h: X(325), barDir: "col", barGapWidthPct: 40, chartColors: [C.blue], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 12,
      valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: C.soft, catAxisLineShow: false,
    });
    const evening = hours.filter((h) => h >= 18).length;
    darkNote(s, 58, 533, 615, 105, [{ text: `${ID(evening)} peserta (${P(evening, hours.length)})`, options: { bold: true, color: C.orange } }, { text: " memulai tes pada pukul 18.00 ke atas. Jendela tes 24 jam membantu peserta mengatur waktu di luar jam kerja." }]);
    const mins = nums(fin.map((r) => r.minutes)), ans = nums(fin.map((r) => r.answered));
    const all = ans.filter((n) => n >= totalQ).length, most = ans.filter((n) => n >= totalQ - 5).length, few = ans.filter((n) => n < totalQ - 10).length;
    const cards: [string, string, string, string, string][] = [
      ["clock", C.blue, `${ID(Math.round(mean(mins)))} menit`, "Rata-rata durasi pengerjaan", `Median ${ID(Math.round(median(mins)))} menit dari batas ±${ID(limitMin)} menit`],
      ["check", C.blue, ID(all), `Menjawab seluruh ${ID(totalQ)} soal`, `${P(all, fin.length)} peserta; ${ID(most)} peserta (${P(most, fin.length)}) menjawab ≥ ${ID(totalQ - 5)} soal`],
      ["list", C.orange, ID(few), `Menjawab kurang dari ${ID(totalQ - 10)} soal`, `${P(few, fin.length)} peserta; manajemen waktu perlu dilatih`],
    ];
    cards.forEach(([ic, col, big, t, d], i) => {
      const y = 168 + i * 158.5;
      box(s, 701, y, 519, 140, C.card);
      dot(s, 724, y + 38, 63, col, ic);
      T(s, big, { x: X(811), y: X(y + 14), w: X(390), h: X(36), fontSize: 24, bold: true, color: C.navy, valign: "middle" });
      T(s, t, { x: X(811), y: X(y + 60), w: X(390), h: X(24), fontSize: 13, bold: true, color: C.navy, valign: "middle" });
      T(s, d, { x: X(811), y: X(y + 92), w: X(390), h: X(36), fontSize: 10.5, color: C.soft });
    });
  }

  // ================= 10. Integritas =================
  {
    const s = base("Catatan integritas ujian", test.secureMode ? "Tes berjalan dalam secure mode; sistem mencatat aktivitas di luar layar tes" : "Sistem mencatat aktivitas di luar layar tes");
    const ev = (r: Row) => (r.tabHidden ?? 0) + (r.fullscreenExit ?? 0) + (r.paste ?? 0);
    const flagged = fin.filter((r) => ev(r) > 0), pasted = fin.filter((r) => (r.paste ?? 0) > 0);
    const tabP = fin.filter((r) => (r.tabHidden ?? 0) > 0), fsP = fin.filter((r) => (r.fullscreenExit ?? 0) > 0);
    const sum = (rs: Row[], k: "tabHidden" | "fullscreenExit") => rs.reduce((n, r) => n + (r[k] ?? 0), 0);
    const cards: [string, string, string, string, string][] = [
      ["clipboard", C.green, ID(pasted.length), "Aktivitas paste", pasted.length ? `${P(pasted.length, fin.length)} peserta menempel teks selama tes` : "Tidak ada aktivitas tempel teks selama tes"],
      ["shield", C.blue, ID(fin.length - flagged.length), "Tanpa catatan", `${P(fin.length - flagged.length, fin.length)} peserta tanpa satu pun catatan aktivitas`],
      ["eye-off", C.orange, ID(flagged.length), "Dengan catatan", `${P(flagged.length, fin.length)} peserta: ${ID(tabP.length)} berpindah tab (${ID(sum(tabP, "tabHidden"))} kali), ${ID(fsP.length)} keluar layar penuh (${ID(sum(fsP, "fullscreenExit"))} kali)`],
    ];
    cards.forEach(([ic, col, big, t, d], i) => {
      const x = 58 + i * 393.5;
      box(s, x, 168, 370, 192, C.card);
      dot(s, x + 24, 187, 59, col, ic);
      T(s, big, { x: X(x + 100), y: X(190), w: X(250), h: X(54), fontSize: 34, bold: true, color: C.navy, valign: "middle" });
      T(s, t, { x: X(x + 24), y: X(258), w: X(330), h: X(26), fontSize: 14, bold: true, color: C.navy, valign: "middle" });
      T(s, d, { x: X(x + 24), y: X(292), w: X(330), h: X(50), fontSize: 11, color: C.soft });
    });
    T(s, "Peserta dengan catatan aktivitas tertinggi (untuk ditinjau)", { x: X(58), y: X(384), w: X(720), h: X(26), fontSize: 14, bold: true, color: C.navy, valign: "middle" });
    const top = [...flagged].sort((a, b) => ev(b) - ev(a) || a.name.localeCompare(b.name)).slice(0, 5);
    if (top.length) {
      const body = top.map((r, i) => [title(r.name), String(r.tabHidden ?? 0), String(r.fullscreenExit ?? 0), String(r.score)].map((t, j) => ({ text: t, options: { align: (j ? "center" : "left") as PptxGenJS.HAlign, fill: { color: i % 2 ? C.card : C.white } } })));
      s.addTable([tableHead(["Nama peserta", "Pindah tab", "Keluar layar penuh", "Skor"], 11, ["left", "center", "center", "center"]), ...body], { x: X(58), y: X(427), w: X(720), colW: [X(345), X(115), X(163), X(97)], rowH: X(35), fontFace: FONT, fontSize: 11, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.02, 0.1, 0.02, 0.1] });
    } else {
      box(s, 58, 427, 720, 90, C.card);
      T(s, "Tidak ada peserta dengan catatan aktivitas.", { x: X(82), y: X(437), w: X(670), h: X(70), fontSize: 13, color: C.ink, valign: "middle" });
    }
    box(s, 806, 384, 414, 251, C.navy);
    T(s, "Cara membaca catatan ini", { x: X(830), y: X(398), w: X(370), h: X(28), fontSize: 15, bold: true, color: C.orange, valign: "middle" });
    T(s, "Catatan sistem bukan bukti pelanggaran. Perpindahan tab dapat terjadi karena notifikasi atau gangguan perangkat. Skor tetap ditampilkan; bila diperlukan, institusi dapat melakukan konfirmasi kepada peserta terkait.", { x: X(830), y: X(440), w: X(370), h: X(170), fontSize: 13, color: C.white });
  }

  // ================= 11. Skor tertinggi =================
  {
    const sorted = [...fin].sort((a, b) => b.score! - a.score! || a.name.localeCompare(b.name));
    const cut = sorted[Math.min(11, sorted.length - 1)].score!;
    const top = sorted.filter((r) => r.score! >= cut).slice(0, 12);
    const rank = (sc: number) => sorted.findIndex((r) => r.score === sc) + 1;
    const allC1 = top.every((r) => r.cefr === "C1");
    const s = base("Peserta dengan skor tertinggi", `${ID(top.length)} peserta dengan skor ≥ ${cut}${allC1 ? ", seluruhnya setara CEFR C1" : ""}`);
    const body = top.map((r, i) => {
      const pr = personal(r);
      const best = KEYS.reduce((a, k) => ((r[k] ?? 0) > (r[a] ?? 0) ? k : a), "listening" as Sec);
      return [String(rank(r.score!)), title(r.name), String(r.score), String(r.listening ?? "-"), String(r.structure ?? "-"), String(r.reading ?? "-"), r.cefr, pr.strong.length ? pr.strong.map((t) => t.name).join(", ") : SHORT[best]].map((t, j) => ({
        text: t, options: { align: (j === 1 || j === 7 ? "left" : "center") as PptxGenJS.HAlign, bold: j === 2, fontSize: j === 7 ? 10 : 11.5, fill: { color: rank(r.score!) <= 3 ? C.cream : i % 2 ? C.white : C.card } },
      }));
    });
    const rh = Math.min(36.5, 440 / (top.length + 1));
    s.addTable([tableHead(["No", "Nama peserta", "Total", "L", "S", "R", "CEFR", "Paling kuat di"], 11.5, ["center", "left", "center", "center", "center", "center", "center", "left"]), ...body], { x: X(58), y: X(163), w: X(1162), colW: [X(55), X(340), X(70), X(55), X(55), X(55), X(62), X(470)], rowH: X(rh), fontFace: FONT, fontSize: 11.5, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.02, 0.1, 0.02, 0.1] });
    // ringkasan kekuatan kelompok teratas
    const cnt = new Map<string, number>();
    for (const r of top) for (const t of personal(r).strong) cnt.set(`${t.name} (${t.section})`, (cnt.get(`${t.name} (${t.section})`) ?? 0) + 1);
    const common = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (common.length) T(s, [{ text: "Kekuatan bersama peserta teratas: ", options: { bold: true, color: C.orange } }, { text: common.map(([k, n]) => `${k} pada ${n} peserta`).join(" · ") + `. Rata-rata bagian kelompok ini: Listening ${ID(secAvg(top, "listening"), 1)} · Structure ${ID(secAvg(top, "structure"), 1)} · Reading ${ID(secAvg(top, "reading"), 1)}.` }], { x: X(58), y: X(612), w: X(1162), h: X(40), fontSize: 11, color: C.ink, valign: "middle" });
  }

  // ================= 11a. Skor terendah: apa masalahnya =================
  {
    const asc = [...fin].sort((a, b) => a.score! - b.score! || a.name.localeCompare(b.name));
    const low = asc.slice(0, Math.min(10, Math.max(3, Math.floor(fin.length * 0.1))));
    if (fin.length >= 5) {
      const mid = median(nums(fin.map((r) => r.minutes)));
      const issues = (r: Row) => {
        const out: string[] = [];
        const blank = totalQ - (r.answered ?? totalQ);
        if (blank >= 10) out.push(`${blank} soal tidak dijawab`);
        if (r.minutes != null && limitMin && r.minutes < limitMin * 0.5) out.push(`selesai cepat (${r.minutes} menit)`);
        const lowSec = KEYS.reduce((a, k) => ((r[k] ?? 99) < (r[a] ?? 99) ? k : a), "listening" as Sec);
        if (r[lowSec] != null) out.push(`${SHORT[lowSec]} terendah (${r[lowSec]})`);
        const w = personal(r).weak;
        if (w.length) out.push(`lemah di ${w.map((t) => t.name).join(" & ")}`);
        if ((r.tabHidden ?? 0) + (r.fullscreenExit ?? 0) >= 5) out.push(`${(r.tabHidden ?? 0) + (r.fullscreenExit ?? 0)} kali keluar layar tes`);
        return out.join("; ");
      };
      const s = base("Peserta dengan skor terendah", `${ID(low.length)} peserta dengan skor terendah dan dugaan penyebabnya, sebagai prioritas pendampingan`);
      const body = low.map((r, i) => [String(i + 1), title(r.name), String(r.score), String(r.listening ?? "-"), String(r.structure ?? "-"), String(r.reading ?? "-"), r.minutes != null ? `${r.minutes}′` : "-", `${r.answered ?? "-"}/${totalQ}`, issues(r)].map((t, j) => ({
        text: t, options: { align: (j === 1 || j === 8 ? "left" : "center") as PptxGenJS.HAlign, bold: j === 2, fontSize: j === 8 ? 9.5 : 11, fill: { color: i % 2 ? C.card : C.white } },
      })));
      const rh = Math.min(36, 380 / (low.length + 1));
      s.addTable([tableHead(["No", "Nama peserta", "Total", "L", "S", "R", "Durasi", "Dijawab", "Masalah utama"], 11, ["center", "left", "center", "center", "center", "center", "center", "center", "left"]), ...body], { x: X(58), y: X(150), w: X(1162), colW: [X(42), X(250), X(58), X(44), X(44), X(44), X(62), X(72), X(546)], rowH: X(rh), fontFace: FONT, fontSize: 11, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.02, 0.08, 0.02, 0.08] });
      // highlight kelompok
      const blankers = low.filter((r) => totalQ - (r.answered ?? totalQ) >= 10).length;
      const fast = low.filter((r) => r.minutes != null && limitMin && r.minutes < limitMin * 0.5).length;
      const la = KEYS.map((k) => secAvg(low, k)), lw = KEYS[la.indexOf(Math.min(...la))];
      const common = topicAgg(low).slice(0, 3).map((t) => `${t.name} (${ID(t.pct, 0)}%)`);
      const parts: string[] = [`rata-rata L ${ID(la[0], 1)} · S ${ID(la[1], 1)} · R ${ID(la[2], 1)}, dengan ${SEC[lw]} paling rendah`];
      if (common.length) parts.push(`topik paling lemah bersama: ${common.join(", ")}`);
      if (blankers) parts.push(`${ID(blankers)} orang meninggalkan ≥ 10 soal kosong (manajemen waktu)`);
      if (fast) parts.push(`${ID(fast)} orang selesai kurang dari separuh waktu (median seluruh peserta ${ID(Math.round(mid))} menit), kemungkinan kurang serius atau menebak`);
      darkNote(s, 58, 150 + rh * (low.length + 1) + 14, 1162, Math.max(96, 640 - (150 + rh * (low.length + 1) + 14)), [
        { text: "Highlight kelompok ini: ", options: { bold: true, color: C.orange } },
        { text: parts.join("; ") + ". Disarankan pendampingan fondasi, latihan bertahap, dan konfirmasi kepada peserta yang menyelesaikan tes sangat cepat." },
      ], "info");
    }
  }

  // ================= 11b. Kekuatan dan kelemahan per peserta =================
  {
    const profs = fin.map((r) => ({ r, ...personal(r) }));
    const tally = (pick: (x: (typeof profs)[number]) => PersonTopic | undefined) => {
      const m = new Map<string, { label: string; n: number }>();
      for (const x of profs) { const t = pick(x); if (!t) continue; const k = `${t.name}|${t.section}`; const a = m.get(k) ?? { label: `${t.name} · ${t.section}`, n: 0 }; a.n++; m.set(k, a); }
      return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 6);
    };
    const weakT = tally((x) => x.weak[0]), strongT = tally((x) => x.strong[0]);
    if (weakT.length && strongT.length) {
      const s = base("Kekuatan dan kelemahan per peserta", "Ringkasan topik terkuat dan terlemah masing-masing peserta (topik dengan minimal 2 soal)");
      const col = (x: number, head: string, list: { label: string; n: number }[], color: string) => {
        T(s, head, { x: X(x), y: X(160), w: X(560), h: X(24), fontSize: 14, bold: true, color: C.navy });
        const max = Math.max(...list.map((l) => l.n));
        list.forEach((l, i) => {
          const y = 196 + i * 50;
          const bw = Math.max(10, (170 * l.n) / max);
          T(s, l.label, { x: X(x), y: X(y), w: X(232), h: X(40), fontSize: 11.5, color: C.ink, valign: "middle" });
          box(s, x + 238, y + 12, bw, 18, color, 0.3);
          T(s, `${ID(l.n)} peserta (${P(l.n, fin.length)})`, { x: X(x + 238 + bw + 8), y: X(y), w: X(140), h: X(40), fontSize: 10.5, color: C.soft, valign: "middle" });
        });
      };
      col(58, "Kelemahan utama yang paling sering", weakT, C.red);
      col(648, "Kekuatan utama yang paling sering", strongT, C.green);
      darkNote(s, 58, 520, 1162, 118, [
        { text: "Cara membaca: ", options: { bold: true, color: C.orange } },
        { text: `${weakT[0].label.split(" · ")[0]} menjadi kelemahan utama bagi ${ID(weakT[0].n)} peserta, sedangkan ${strongT[0].label.split(" · ")[0]} menjadi kekuatan utama bagi ${ID(strongT[0].n)} peserta. Rincian kekuatan dan kelemahan setiap peserta, beserta rencana belajarnya, tersedia di dashboard masing-masing peserta.` },
      ], "info");
    }

    // contoh profil: dari tiap level, satu peserta dengan skor tertinggi dan satu di sekitar median level
    const picks: { r: Row; strong: PersonTopic[]; weak: PersonTopic[]; why: string }[] = [];
    for (const { l, rs } of [...lv].reverse()) {
      const ps = [...rs].sort((a, b) => b.score! - a.score!).map((r) => ({ r, ...personal(r) })).filter((x) => x.strong.length && x.weak.length);
      if (!ps.length) continue;
      picks.push({ ...ps[0], why: `Tertinggi di ${l.name}` });
      if (ps.length > 2) picks.push({ ...ps[Math.floor(ps.length / 2)], why: `Tipikal ${l.name}` });
    }
    if (picks.length) {
      const s = base("Contoh profil peserta", "Kekuatan dan kelemahan beberapa peserta, sebagai gambaran hasil analisis per orang");
      picks.slice(0, 6).forEach((x, i) => {
        const cx = 58 + (i % 3) * 393.5, cy = 160 + Math.floor(i / 3) * 240;
        box(s, cx, cy, 370, 225, C.card);
        T(s, x.why.toUpperCase(), { x: X(cx + 20), y: X(cy + 14), w: X(330), h: X(18), fontSize: 9, bold: true, color: C.orange, charSpacing: 1 });
        T(s, [{ text: title(x.r.name), options: { bold: true, fontSize: 14, color: C.navy, breakLine: true } }, { text: `Skor ${x.r.score} · ${x.r.level} · CEFR ${x.r.cefr} · L ${x.r.listening ?? "-"} / S ${x.r.structure ?? "-"} / R ${x.r.reading ?? "-"}`, options: { fontSize: 10, color: C.soft } }], { x: X(cx + 20), y: X(cy + 36), w: X(330), h: X(48), valign: "top" });
        T(s, [{ text: "Kuat: ", options: { bold: true, color: C.green } }, { text: fmtTopics(x.strong) }], { x: X(cx + 20), y: X(cy + 98), w: X(330), h: X(52), fontSize: 11, color: C.ink });
        T(s, [{ text: "Perlu ditingkatkan: ", options: { bold: true, color: C.red } }, { text: fmtTopics(x.weak) }], { x: X(cx + 20), y: X(cy + 154), w: X(330), h: X(56), fontSize: 11, color: C.ink });
      });
    }
  }

  // ================= 12. Rekomendasi =================
  {
    const s = base("Rekomendasi untuk tahap pembelajaran", `Tindak lanjut yang disarankan berdasarkan hasil ${perDay ? "sesi ini" : "seluruh sesi"}`);
    const weakOf = (rs: Row[]) => [...KEYS].sort((a, b) => secAvg(rs, a) - secAvg(rs, b));
    const hi = lv[lv.length - 1], mid = lv.length > 2 ? lv[1] : null, low = lv[0];
    const inactive = moved.filter((m) => !m.active).length;
    const cards: [string, string, string, string][] = [
      ["rocket", C.navy, `${hi.l.name} · ${ID(hi.rs.length)} peserta`, `Pembelajaran padat dan intensif untuk menjaga skor ≥ ${target} dan mendorong ke 600-an${hi.rs.length ? `, dengan fokus ${weakOf(hi.rs).slice(0, 2).map((k) => SHORT[k]).join(" dan ")}` : ""}.`],
      ["target", C.blue, mid ? `${mid.l.name} · ${ID(mid.rs.length)} peserta` : "Kelompok dekat target", `Prioritaskan ${ID(near)} peserta di rentang ${target - 50}–${target - 1}.${mid?.rs.length ? ` Fokus utama ${SEC[weakOf(mid.rs)[0]]} dan strategi waktu.` : ""}`],
      ["sprout", C.sky, `${low.l.name} · ${ID(low.rs.length)} peserta`, "Pembelajaran lebih banyak dan bertahap: grammar dasar, kosakata akademik, dan pemahaman audio."],
      ["layers", C.orange, "Materi bersama", `${SEC[weakPer]} menjadi materi prioritas lintas level${topics.length ? `, terutama ${topics.slice(0, 2).map((t) => t.name).join(" dan ")}` : ""}, dipadukan latihan manajemen waktu.`],
      ["users", C.green, "Tindak lanjut jadwal", moved.length ? `Pastikan ${ID(moved.length)} peserta yang pindah jadwal mengikuti tes di tanggal barunya${inactive ? `; ${ID(inactive)} akun perlu segera diaktifkan` : ""}.`
        : absentRows.length ? `Hubungi ${ID(absentRows.length)} peserta yang tidak hadir untuk dijadwalkan ulang.`
        : pendingRows.length ? `${ID(pendingRows.length)} peserta masih dijadwalkan; pastikan akun mereka sudah aktif sebelum tes.`
        : "Seluruh peserta terjadwal sudah menyelesaikan tes; kelas dapat segera dibentuk per level."],
      ["brain", C.red, "Diagnostik AI berkelanjutan", "Setiap latihan di LMS akan kembali dianalisis sehingga institusi dapat memantau perkembangan per peserta."],
    ];
    cards.forEach(([ic, col, t, d], i) => {
      const x = 58 + (i % 3) * 393.5, y = 168 + Math.floor(i / 3) * 240;
      box(s, x, y, 370, 222, C.card);
      dot(s, x + 24, y + 24, 63, col, ic);
      T(s, t, { x: X(x + 24), y: X(y + 96), w: X(330), h: X(28), fontSize: 15, bold: true, color: C.navy, valign: "middle" });
      T(s, d, { x: X(x + 24), y: X(y + 134), w: X(330), h: X(80), fontSize: 11.5, color: C.ink });
    });
  }

  // ================= 13. Catatan =================
  {
    const s = base("Catatan dan langkah berikutnya", "Hal yang perlu diperhatikan institusi dalam membaca laporan ini");
    const later = allSess.filter((x) => x.opensAt > (sess?.opensAt ?? now));
    const held = fin.filter((r) => String(r.released).startsWith("At")).length + rows.filter((r) => r.released === "Held").length;
    const cards: [string, string, string, string][] = [
      ["calendar", C.blue, later.length ? `${test.name} berlanjut` : "Seluruh sesi selesai", later.length ? `Sesi berikutnya berlangsung ${TGL(later[0].opensAt, false)}${later.length > 1 ? ` – ${TGL(later[later.length - 1].opensAt, false)}` : ""}. Laporan kumulatif dapat diunduh kapan saja dari English Inspira AI.` : "Laporan ini dapat diunduh ulang kapan saja dari English Inspira AI bila ada pembaruan data."],
      ["file", C.blue, held ? "Skor bersifat sementara" : "Skor sudah dirilis", held ? `Skor ${held === fin.length ? "" : `${ID(held)} peserta `}masih berstatus provisional dan belum dirilis ke peserta. Rilis hasil mengikuti jadwal program.` : "Hasil sudah dapat dilihat peserta di dashboard masing-masing beserta analisis AI."],
      ["info", C.orange, "Skor estimasi, bukan skor resmi", "Skor adalah estimasi dari English Inspira AI pada skala 310–677, bukan skor resmi TOEFL ITP®."],
      ["chart", C.blue, "Pemantauan melalui dashboard", "Institusi dapat memantau hasil dan perkembangan peserta melalui dashboard dan laporan pembelajaran."],
    ];
    cards.forEach(([ic, col, t, d], i) => {
      const x = 58 + (i % 2) * 590, y = 168 + Math.floor(i / 2) * 211;
      box(s, x, y, 572, 197, C.card);
      dot(s, x + 28, y + 29, 68, col, ic);
      T(s, t, { x: X(x + 120), y: X(y + 28), w: X(430), h: X(30), fontSize: 17, bold: true, color: C.navy, valign: "middle" });
      T(s, d, { x: X(x + 120), y: X(y + 74), w: X(430), h: X(100), fontSize: 12, color: C.ink });
    });
    T(s, "TOEFL dan TOEFL ITP adalah merek dagang milik ETS. English Inspira tidak berafiliasi dengan ETS.", { x: X(58), y: X(603), w: X(1162), h: X(18), fontSize: 9, italic: true, color: C.soft, align: "center" });
  }

  // ================= 14+. Lampiran =================
  {
    const list = [...fin].sort((a, b) => a.name.localeCompare(b.name, "id"));
    const PER = 48, pages = Math.ceil(list.length / PER);
    const cell = (r: Row, n: number, i: number) => [String(n), title(r.name), String(r.score), String(r.listening ?? "-"), String(r.structure ?? "-"), String(r.reading ?? "-"), r.level].map((t, j) => ({
      text: t, options: { align: (j === 1 ? "left" : "center") as PptxGenJS.HAlign, bold: j === 2, fill: { color: i % 2 ? C.card : C.white } },
    }));
    for (let pg = 0; pg < pages; pg++) {
      const s = base(`Lampiran: daftar nilai peserta (${pg + 1}/${pages})`, "L = Listening · S = Structure & Written Expression · R = Reading · skor bagian skala 31–68");
      for (let half = 0; half < 2; half++) {
        const chunk = list.slice(pg * PER + half * 24, pg * PER + half * 24 + 24);
        if (!chunk.length) continue;
        s.addTable([tableHead(["No", "Nama peserta", "Total", "L", "S", "R", "Level"], 8.5, ["center", "left", "center", "center", "center", "center", "center"]), ...chunk.map((r, i) => cell(r, pg * PER + half * 24 + i + 1, i))], {
          x: X(58 + half * 590), y: X(154), w: X(572), colW: [X(42), X(262), X(48), X(37), X(37), X(37), X(109)], rowH: X(19.8), fontFace: FONT, fontSize: 8, color: C.ink, valign: "middle", border: { type: "solid", color: C.line, pt: 0.5 }, margin: [0, 0.06, 0, 0.06],
        });
      }
    }
  }

  // ================= Penutup =================
  {
    const s = p.addSlide();
    s.background = { data: img("bg-closing.png") };
    T(s, "TERIMA KASIH", { x: X(67), y: X(68), w: X(600), h: X(22), fontSize: 12, bold: true, color: C.orange, charSpacing: 3 });
    T(s, perDay ? "Awal yang kuat sudah dimulai." : "Peta kemampuan sudah lengkap.", { x: X(67), y: X(112), w: X(720), h: X(56), fontSize: 30, bold: true, color: C.navy });
    T(s, perDay ? "Skor terbaik menanti di depan." : "Saatnya belajar lebih terarah.", { x: X(67), y: X(172), w: X(720), h: X(56), fontSize: 30, bold: true, color: C.orange });
    T(s, `Terima kasih kepada ${inst ? `institusi dan seluruh peserta ${inst}` : "institusi dan seluruh peserta"} atas semangatnya${perDay ? " hari ini" : ""}. Setiap jawaban menjadi peta belajar menuju ${target} dan lebih tinggi lagi.`, { x: X(67), y: X(285), w: X(680), h: X(80), fontSize: 14, color: C.ink });
    T(s, perDay ? "Laporan hari berikutnya dan laporan keseluruhan dapat diunduh setelah setiap sesi selesai." : "Laporan ini dapat diunduh ulang kapan saja dari English Inspira AI untuk angka terbaru.", { x: X(67), y: X(402), w: X(680), h: X(44), fontSize: 11, italic: true, color: C.soft });
    s.addShape(p.ShapeType.roundRect, { x: X(806), y: X(125), w: X(414), h: X(375), fill: { color: C.white }, line: { color: C.line, width: 1 }, rectRadius: 0.12 });
    T(s, "Hubungi kami", { x: X(840), y: X(150), w: X(350), h: X(30), fontSize: 18, bold: true, color: C.navy, valign: "middle" });
    ([["whatsapp", "+62 851 1163 6633"], ["mail", "nusainspirateknologi@gmail.com"], ["globe", "english.edulyfe.id"]] as const).forEach(([ic, t], i) => {
      dot(s, 840, 220 + i * 82, 54, C.blue, ic);
      T(s, t, { x: X(907), y: X(232 + i * 82), w: X(300), h: X(30), fontSize: 13, color: C.ink, valign: "middle" });
    });
    s.addShape(p.ShapeType.line, { x: X(470), y: X(570), w: X(750), h: 0, line: { color: C.line, width: 1 } });
    s.addImage({ data: L.inspira, x: X(470), y: X(590), w: X(78 * LOGO.inspira), h: X(78) });
    T(s, "Learn Smarter. Improve Faster. Certify with Confidence.", { x: X(470), y: X(530), w: X(750), h: X(30), fontSize: 14, bold: true, italic: true, color: C.blue, align: "right", valign: "middle" });
    partners(s, 878, 592, 72);
  }

  return { buffer: Buffer.from((await p.stream({ compression: true })) as Uint8Array), name: perDay ? `${test.name} - ${scopeLabel}` : test.name };
}
