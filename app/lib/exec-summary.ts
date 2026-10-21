import PptxGenJS from "pptxgenjs";
import { collectTestRows } from "./test-export";

type Row = NonNullable<Awaited<ReturnType<typeof collectTestRows>>>["rows"][number];

const NAVY = "0A2257", BRAND = "0B4FA6", SOFT = "4A5568", LINE = "DCE3EE", BG = "F8FAFD", OK = "1D6B3F", WARN = "B7791F", BAD = "B42318";
const FONT = "Poppins";
const ID = (n: number, d = 0) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (a: number, b: number) => (b ? `${ID((a / b) * 100, 1)}%` : "0%");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = (xs: number[]) => { const m = mean(xs); return xs.length ? Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) : 0; };
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number");
const TGL = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const HARI: Record<string, string> = { Mon: "Senin", Tue: "Selasa", Wed: "Rabu", Thu: "Kamis", Fri: "Jumat", Sat: "Sabtu", Sun: "Minggu", Jan: "Jan", Feb: "Feb", Mar: "Mar", Apr: "Apr", May: "Mei", Jun: "Jun", Jul: "Jul", Aug: "Agu", Sep: "Sep", Oct: "Okt", Nov: "Nov", Dec: "Des" };
/** "Tue, 20 Oct 2026" → "Selasa, 20 Okt 2026" */
const hari = (d: string) => d.replace(/[A-Z][a-z]{2}/g, (w) => HARI[w] ?? w);
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & Written Expression", reading: "Reading" };

/**
 * Executive summary (.pptx) hasil satu tes: per sesi/hari (sessionId) atau keseluruhan.
 * Semua angka dari data yang sama dengan ekspor Excel; akun QA tidak dihitung.
 */
export async function buildExecSummary(testId: string, opts: { sessionId?: string; target?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date(), target = opts.target ?? 550;
  const got = await collectTestRows(testId, now, opts.sessionId);
  if (!got) return null;
  const { test, sessions, levels } = got;
  const rows = got.rows.filter((r) => !r.qa);
  const fin = rows.filter((r) => r.status === "Finished" && typeof r.score === "number");
  const scores = fin.map((r) => r.score!);
  const perDay = !!opts.sessionId;
  const scope = perDay ? `${sessions[0].label} · ${TGL(sessions[0].opensAt)}` : sessions.length ? `Keseluruhan · ${TGL(sessions[0].opensAt)} – ${TGL(sessions[sessions.length - 1].opensAt)}` : "Keseluruhan";
  const insts = [...new Set(rows.map((r) => r.institution).filter(Boolean))];

  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  p.author = "English Inspira AI";
  p.title = `Executive Summary – ${test.name}`;
  p.defineSlideMaster({ title: "M", background: { color: BG }, objects: [{ rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: BRAND } } }], slideNumber: { x: 12.4, y: 7.0, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9, color: SOFT } });

  const base = (title: string, sub?: string) => {
    const s = p.addSlide({ masterName: "M" });
    s.addText(title, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: NAVY });
    if (sub) s.addText(sub, { x: 0.6, y: 1.0, w: 12, h: 0.45, fontFace: FONT, fontSize: 14, color: SOFT });
    s.addText(`English Inspira AI · ${test.name} · ${perDay ? sessions[0].label : "Keseluruhan"}`, { x: 0.6, y: 7.0, w: 10, h: 0.3, fontFace: FONT, fontSize: 9, color: SOFT });
    return s;
  };
  const card = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, big: string, label: string, note = "", color = NAVY) => {
    s.addShape(p.ShapeType.roundRect, { x, y, w, h, fill: { color: "FFFFFF" }, line: { color: LINE, width: 1 }, rectRadius: 0.12 });
    s.addText(big, { x: x + 0.25, y: y + 0.15, w: w - 0.5, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color });
    s.addText(label, { x: x + 0.25, y: y + 0.95, w: w - 0.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: NAVY });
    if (note) s.addText(note, { x: x + 0.25, y: y + 1.35, w: w - 0.5, h: h - 1.45, fontFace: FONT, fontSize: 11, color: SOFT, valign: "top" });
  };
  const note = (s: PptxGenJS.Slide, text: string, y = 6.2) => s.addText(text, { x: 0.6, y, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 13, color: NAVY, fill: { color: "EAF1FB" }, margin: 10 });
  const cells = (xs: string[]) => xs.map((text) => ({ text }));
  const chartOpts = { fontFace: FONT, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontSize: 10, showValue: true, dataLabelColor: NAVY, valGridLine: { color: "E5EAF2", size: 0.5 } } as const;

  // 1. Sampul
  const c = p.addSlide();
  c.background = { color: NAVY };
  c.addText(`LAPORAN UNTUK ${insts.length === 1 ? insts[0].toUpperCase() : "INSTITUSI"}`, { x: 0.8, y: 1.2, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: "9DB8E8", charSpacing: 3 });
  c.addText(`Hasil ${test.name}`, { x: 0.8, y: 1.8, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 44, bold: true, color: "FFFFFF" });
  c.addText(scope, { x: 0.8, y: 3.0, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 22, color: "FFFFFF" });
  c.addText(`${ID(fin.length)} peserta menyelesaikan tes${fin.length ? ` · rata-rata skor ${ID(Math.round(mean(scores)))}` : ""}`, { x: 0.8, y: 3.8, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 16, color: "C9D7F0" });
  c.addText(`Data diambil dari English Inspira AI pada ${now.toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`, { x: 0.8, y: 6.6, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 11, color: "9DB8E8" });

  if (!fin.length) {
    const s = base("Belum ada hasil", "Belum ada peserta yang menyelesaikan tes pada cakupan laporan ini.");
    card(s, 0.6, 1.8, 3.8, 1.9, ID(rows.length), "Peserta terjadwal");
    return { buffer: Buffer.from((await p.write({ outputType: "nodebuffer" })) as ArrayBuffer), name: perDay ? `${test.name} - ${sessions[0].label}` : test.name };
  }

  const present = rows.filter((r) => r.attendance === "Present").length;
  const absent = rows.filter((r) => r.attendance === "Absent").length;
  const pending = rows.length - present - absent;
  const above = scores.filter((x) => x >= target).length;
  const lvl = levels.map((l) => ({ l, rs: fin.filter((r) => r.level === l.name) }));
  const secAvg = (rs: Row[], k: "listening" | "structure" | "reading") => mean(nums(rs.map((r) => r[k])));

  // 2. Ringkasan eksekutif
  {
    const s = base("Ringkasan eksekutif", `Gambaran umum hasil ${perDay ? "sesi ini" : "seluruh sesi"}`);
    card(s, 0.6, 1.7, 2.9, 2.3, pct(fin.length, present || fin.length), "Tingkat penyelesaian", `${ID(fin.length)} dari ${ID(present)} peserta yang hadir menyelesaikan tes`);
    card(s, 3.7, 1.7, 2.9, 2.3, ID(Math.round(mean(scores))), "Rata-rata skor", `Median ${ID(median(scores))} · rentang ${Math.min(...scores)}–${Math.max(...scores)}`);
    card(s, 6.8, 1.7, 2.9, 2.3, ID(above), `Peserta ≥ ${target}`, `${pct(above, fin.length)} peserta sudah mencapai target; ${ID(scores.filter((x) => x >= 600).length)} di antaranya ≥ 600`, OK);
    card(s, 9.9, 1.7, 2.9, 2.3, ID(rows.length), "Peserta terjadwal", `${ID(absent)} tidak hadir${pending ? ` · ${ID(pending)} belum/sedang tes` : ""}`);
    lvl.forEach(({ l, rs }, i) => card(s, 0.6 + i * 4.1, 4.3, 3.9, 1.7, ID(rs.length), `Level ${l.name}`, `${pct(rs.length, fin.length)} · skor ${l.scoreMin}–${l.scoreMax}`, BRAND));
  }

  // 3. Kehadiran
  {
    const s = base("Kehadiran dan penyelesaian tes", `${ID(present)} dari ${ID(rows.length)} peserta terjadwal hadir (${pct(present, rows.length)})`);
    const ch = perDay ? 1.9 : 1.45;
    card(s, 0.6, 1.6, 2.9, ch, ID(rows.length), "Terjadwal");
    card(s, 3.7, 1.6, 2.9, ch, ID(fin.length), "Hadir & selesai", "", OK);
    card(s, 6.8, 1.6, 2.9, ch, ID(absent), "Tidak hadir", perDay ? "Sesi sudah tutup tanpa mulai" : "", absent ? BAD : NAVY);
    card(s, 9.9, 1.6, 2.9, ch, ID(pending), "Belum selesai", perDay ? "Sedang tes atau sesi belum tutup" : "", pending ? WARN : NAVY);
    if (!perDay) {
      const days = [...new Set(rows.map((r) => r.scheduledDay || "Tanpa jadwal"))];
      const head = ["Hari", "Terjadwal", "Hadir", "Selesai", "Tidak hadir", "Rata-rata skor"].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }));
      const body = days.map((d) => { const rs = rows.filter((r) => (r.scheduledDay || "Tanpa jadwal") === d), f = rs.filter((r) => r.status === "Finished" && r.score != null); return cells([hari(d), ID(rs.length), ID(rs.filter((r) => r.attendance === "Present").length), ID(f.length), ID(rs.filter((r) => r.attendance === "Absent").length), f.length ? ID(Math.round(mean(f.map((r) => r.score!)))) : "-"]); });
      s.addTable([head, ...body], { x: 0.6, y: 3.25, w: 12.1, fontFace: FONT, fontSize: Math.min(11, 3.5 / (body.length + 1) * 28), color: NAVY, border: { type: "solid", color: LINE, pt: 0.5 }, rowH: Math.min(0.32, 3.5 / (body.length + 1)), margin: 2, autoPage: false });
    } else note(s, absent ? `${ID(absent)} peserta tidak hadir pada sesi ini; daftar namanya ada di ekspor Excel (sheet Attendance).` : "Seluruh peserta yang hadir pada sesi ini tercatat di sistem; daftar lengkap ada di ekspor Excel (sheet Attendance).", 4.0);
  }

  // 4. Sebaran skor
  {
    const s = base("Sebaran skor total peserta", "Skor estimasi skala 310–677, dikelompokkan per 25 poin");
    const lo = Math.floor(Math.min(...scores) / 25) * 25, hi = Math.floor(Math.max(...scores) / 25) * 25;
    const bins: string[] = [], vals: number[] = [];
    for (let b = lo; b <= hi; b += 25) { bins.push(`${b}–${b + 24}`); vals.push(scores.filter((x) => x >= b && x < b + 25).length); }
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: bins, values: vals }], { ...chartOpts, x: 0.6, y: 1.6, w: 8.6, h: 4.5, barDir: "col", chartColors: [BRAND], catAxisLabelFontSize: 9 });
    const st: [string, string][] = [["Rata-rata", ID(mean(scores), 1)], ["Median", ID(median(scores))], ["Skor tertinggi", ID(Math.max(...scores))], ["Skor terendah", ID(Math.min(...scores))], ["Simpangan baku", ID(sd(scores), 1)]];
    st.forEach(([k, v], i) => { s.addText(k, { x: 9.6, y: 1.7 + i * 0.85, w: 3.1, h: 0.35, fontFace: FONT, fontSize: 12, color: SOFT }); s.addText(v, { x: 9.6, y: 2.0 + i * 0.85, w: 3.1, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: NAVY }); });
    const near = scores.filter((x) => x >= target - 50 && x < target).length;
    note(s, `${ID(near)} peserta berada tepat di bawah target (${target - 50}–${target - 1}); kelompok ini paling cepat didorong melewati ${target}.`);
  }

  // 5. Posisi terhadap target
  {
    const g = [
      { k: "≥ 600", n: scores.filter((x) => x >= 600).length, t: "Melampaui target", col: OK },
      { k: `${target}–599`, n: scores.filter((x) => x >= target && x < 600).length, t: "Sudah mencapai target", col: "2F855A" },
      { k: `${target - 50}–${target - 1}`, n: scores.filter((x) => x >= target - 50 && x < target).length, t: "Dekat target", col: WARN },
      { k: `${target - 100}–${target - 51}`, n: scores.filter((x) => x >= target - 100 && x < target - 50).length, t: "Perlu penguatan", col: "C05621" },
      { k: `< ${target - 100}`, n: scores.filter((x) => x < target - 100).length, t: "Perlu fondasi", col: BAD },
    ].filter((x) => target - 100 < 600 || x.k !== `${target}–599`);
    const s = base(`Posisi peserta terhadap target ${target}`, "Pengelompokan berdasarkan jarak skor ke target program");
    g.forEach((x, i) => card(s, 0.6 + i * 2.44, 1.7, 2.3, 2.6, ID(x.n), x.k, `${pct(x.n, fin.length)} · ${x.t}`, x.col));
    note(s, `${ID(above)} peserta (${pct(above, fin.length)}) di atas garis target · ${ID(fin.length - above)} peserta (${pct(fin.length - above, fin.length)}) di bawah garis target.`, 4.7);
  }

  // 6. Level dan CEFR
  {
    const s = base("Penempatan level dan kesetaraan CEFR", "Level ini menjadi dasar pengelompokan kelas pada tahap pembelajaran");
    lvl.forEach(({ l, rs }, i) => {
      const y = 1.6 + i * 1.5;
      s.addShape(p.ShapeType.roundRect, { x: 0.6, y, w: 7.4, h: 1.35, fill: { color: "FFFFFF" }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
      s.addText(`${ID(rs.length)}`, { x: 0.8, y: y + 0.15, w: 1.4, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: BRAND });
      s.addText(pct(rs.length, fin.length), { x: 0.8, y: y + 0.85, w: 1.4, h: 0.35, fontFace: FONT, fontSize: 12, color: SOFT });
      s.addText([{ text: l.name, options: { bold: true, fontSize: 16, color: NAVY, breakLine: true } }, { text: `Rentang ${l.scoreMin}–${l.scoreMax}${rs.length ? ` · rata-rata ${ID(mean(rs.map((r) => r.score!)), 1)}` : ""}`, options: { fontSize: 12, color: SOFT, breakLine: true } }, { text: rs.length ? `Listening ${ID(secAvg(rs, "listening"), 1)} · Structure ${ID(secAvg(rs, "structure"), 1)} · Reading ${ID(secAvg(rs, "reading"), 1)}` : "Belum ada peserta", options: { fontSize: 12, color: SOFT } }], { x: 2.3, y: y + 0.1, w: 5.6, h: 1.15, fontFace: FONT, valign: "middle" });
    });
    const cefr = ["A1", "A2", "B1", "B2", "C1"];
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: cefr, values: cefr.map((k) => fin.filter((r) => r.cefr === k).length) }], { ...chartOpts, x: 8.3, y: 1.6, w: 4.4, h: 4.4, barDir: "col", chartColors: [NAVY], showTitle: true, title: "Kesetaraan CEFR", titleFontFace: FONT, titleFontSize: 13, titleColor: NAVY });
  }

  // 7. Kemampuan per bagian
  {
    const keys = ["listening", "structure", "reading"] as const;
    const av = keys.map((k) => secAvg(fin, k));
    const weakest = keys[av.indexOf(Math.min(...av))], strongest = keys[av.indexOf(Math.max(...av))];
    const s = base("Kemampuan per bagian tes", `Skor bagian skala 31–68: ${SEC[strongest]} paling kuat, ${SEC[weakest]} paling perlu dikuatkan`);
    s.addChart(p.ChartType.bar, [{ name: "Rata-rata", labels: keys.map((k) => SEC[k]), values: av.map((v) => Math.round(v * 10) / 10) }], { ...chartOpts, x: 0.6, y: 1.6, w: 6.6, h: 4.4, barDir: "bar", chartColors: [BRAND], valAxisMinVal: 31, valAxisMaxVal: 68, dataLabelFormatCode: "0.0" });
    s.addChart(p.ChartType.bar, keys.map((k) => ({ name: SEC[k].split(" ")[0], labels: lvl.map((x) => x.l.name), values: lvl.map((x) => Math.round(secAvg(x.rs, k) * 10) / 10) })), { ...chartOpts, x: 7.4, y: 1.6, w: 5.3, h: 4.4, barDir: "col", chartColors: [NAVY, BRAND, "7FA7E0"], showLegend: true, legendPos: "b", legendFontFace: FONT, valAxisMinVal: 31, valAxisMaxVal: 68, dataLabelFontSize: 8, dataLabelFormatCode: "0.0", showTitle: true, title: "Per level", titleFontFace: FONT, titleFontSize: 13, titleColor: NAVY });
    note(s, `Rata-rata: Listening ${ID(av[0], 1)} · Structure ${ID(av[1], 1)} · Reading ${ID(av[2], 1)}. ${SEC[weakest]} menjadi prioritas materi di tahap pembelajaran.`);
  }

  // 8. Pola pengerjaan
  {
    const s = base("Pola pengerjaan tes", "Kapan peserta mulai mengerjakan dan berapa lama");
    const hours = fin.map((r) => (r.startedAt ? Number(new Date(r.startedAt).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })) % 24 : -1)).filter((h) => h >= 0);
    const slots = ["00–05", "06–08", "09–11", "12–14", "15–17", "18–20", "21–23"], edges = [0, 6, 9, 12, 15, 18, 21, 24];
    s.addChart(p.ChartType.bar, [{ name: "Peserta", labels: slots, values: slots.map((_, i) => hours.filter((h) => h >= edges[i] && h < edges[i + 1]).length) }], { ...chartOpts, x: 0.6, y: 1.6, w: 7.6, h: 4.4, barDir: "col", chartColors: [BRAND], showTitle: true, title: "Jam mulai tes (WIB)", titleFontFace: FONT, titleFontSize: 13, titleColor: NAVY });
    const mins = nums(fin.map((r) => r.minutes));
    card(s, 8.5, 1.6, 4.2, 2.1, `${ID(Math.round(mean(mins)))} menit`, "Rata-rata durasi", `Median ${ID(Math.round(median(mins)))} menit`);
    const evening = hours.filter((h) => h >= 18).length;
    card(s, 8.5, 3.9, 4.2, 2.1, ID(evening), "Mulai pukul 18.00 ke atas", `${pct(evening, hours.length)} peserta mengerjakan di luar jam kerja`);
  }

  // 9. Integritas
  {
    const flagged = fin.filter((r) => (r.tabHidden ?? 0) + (r.fullscreenExit ?? 0) + (r.paste ?? 0) > 0);
    const s = base("Catatan integritas ujian", test.secureMode ? "Tes berjalan dalam secure mode; sistem mencatat aktivitas di luar layar tes" : "Sistem mencatat aktivitas di luar layar tes");
    card(s, 0.6, 1.7, 2.9, 2.2, ID(fin.length - flagged.length), "Tanpa catatan", `${pct(fin.length - flagged.length, fin.length)} peserta tanpa satu pun catatan aktivitas`, OK);
    card(s, 3.7, 1.7, 2.9, 2.2, ID(fin.filter((r) => (r.tabHidden ?? 0) > 0).length), "Pindah tab / aplikasi", "Peserta dengan minimal satu kejadian", WARN);
    card(s, 6.8, 1.7, 2.9, 2.2, ID(fin.filter((r) => (r.fullscreenExit ?? 0) > 0).length), "Keluar layar penuh", "Peserta dengan minimal satu kejadian", WARN);
    card(s, 9.9, 1.7, 2.9, 2.2, ID(fin.filter((r) => (r.paste ?? 0) > 0).length), "Aktivitas paste", "Peserta yang menempel teks selama tes");
    const reviewed = fin.filter((r) => r.review).length;
    note(s, `Catatan aktivitas bukan bukti kecurangan; tiap kejadian dapat ditinjau per soal di Review Proctoring.${reviewed ? ` ${ID(reviewed)} sesi sudah ditinjau admin.` : ""}`, 4.3);
  }

  // 10. Skor tertinggi
  {
    const top = [...fin].sort((a, b) => b.score! - a.score! || a.name.localeCompare(b.name)).slice(0, 12);
    const s = base("Peserta dengan skor tertinggi", `${top.length} peserta teratas`);
    const head = ["No", "Nama peserta", "Total", "Listening", "Structure", "Reading", "CEFR"].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }));
    s.addTable([head, ...top.map((r, i) => cells([String(i + 1), r.name, String(r.score), String(r.listening ?? "-"), String(r.structure ?? "-"), String(r.reading ?? "-"), r.cefr]))], { x: 0.6, y: 1.6, w: 12.1, colW: [0.7, 5.4, 1.2, 1.2, 1.2, 1.2, 1.2], fontFace: FONT, fontSize: 11, color: NAVY, border: { type: "solid", color: LINE, pt: 0.5 }, rowH: 0.36 });
  }

  // 11. Rekomendasi
  {
    const s = base("Rekomendasi untuk tahap pembelajaran", "Tindak lanjut berdasarkan hasil tes");
    const tips: Record<number, string> = {
      0: "Penguatan fondasi grammar, kosakata, dan listening dasar dengan latihan terbimbing dan coaching lebih sering.",
      1: `Fokus pada bagian terlemah tiap peserta; ${ID(scores.filter((x) => x >= target - 50 && x < target).length)} peserta dekat target bisa diprioritaskan untuk latihan soal bertarget.`,
      2: `Pembelajaran intensif untuk mempertahankan skor ≥ ${target} dan mendorong ke 600-an melalui simulasi rutin.`,
    };
    [...lvl].reverse().forEach(({ l, rs }, i) => {
      const y = 1.6 + i * 1.5, idx = lvl.length - 1 - i;
      s.addShape(p.ShapeType.roundRect, { x: 0.6, y, w: 12.1, h: 1.35, fill: { color: "FFFFFF" }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
      const weak = rs.length ? (["listening", "structure", "reading"] as const).reduce((a, k) => (secAvg(rs, k) < secAvg(rs, a) ? k : a), "listening" as "listening" | "structure" | "reading") : null;
      s.addText([{ text: `${l.name} · ${ID(rs.length)} peserta`, options: { bold: true, fontSize: 16, color: NAVY, breakLine: true } }, { text: `${tips[Math.min(idx, 2)]}${weak ? ` Bagian terlemah kelompok ini: ${SEC[weak]} (${ID(secAvg(rs, weak), 1)}).` : ""}`, options: { fontSize: 12, color: SOFT } }], { x: 0.85, y: y + 0.08, w: 11.6, h: 1.2, fontFace: FONT, valign: "middle" });
    });
    note(s, "Analisis AI per peserta (kekuatan, kelemahan per topik, dan rencana belajar) tersedia di dashboard masing-masing peserta.", 6.2);
  }

  // 12+. Lampiran (hanya laporan per hari; keseluruhan memakai Excel)
  if (perDay) {
    const list = [...fin].sort((a, b) => a.name.localeCompare(b.name)), PER = 24, pages = Math.ceil(list.length / PER);
    for (let pg = 0; pg < pages; pg++) {
      const s = base(`Lampiran: daftar nilai peserta (${pg + 1}/${pages})`, "L = Listening · S = Structure & Written Expression · R = Reading · skor bagian skala 31–68");
      const head = ["No", "Nama peserta", "Total", "L", "S", "R", "Level"].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }));
      s.addTable([head, ...list.slice(pg * PER, pg * PER + PER).map((r, i) => cells([String(pg * PER + i + 1), r.name, String(r.score), String(r.listening ?? "-"), String(r.structure ?? "-"), String(r.reading ?? "-"), r.level]))], { x: 0.6, y: 1.55, w: 12.1, colW: [0.7, 5.6, 1.2, 1.0, 1.0, 1.0, 1.6], fontFace: FONT, fontSize: 9, color: NAVY, border: { type: "solid", color: LINE, pt: 0.5 }, rowH: 0.205, margin: 2 });
    }
  } else {
    const s = base("Lampiran", "Daftar nilai lengkap");
    note(s, `Daftar nilai ${ID(fin.length)} peserta beserta kehadiran tersedia di ekspor Excel (Export results) agar mudah difilter dan diolah.`, 1.8);
  }

  // Penutup
  const e = p.addSlide();
  e.background = { color: NAVY };
  e.addText("TERIMA KASIH", { x: 0.8, y: 2.4, w: 11.5, h: 1, fontFace: FONT, fontSize: 40, bold: true, color: "FFFFFF" });
  e.addText(perDay ? "Laporan hari berikutnya dan laporan keseluruhan dapat diunduh kapan saja dari English Inspira AI." : "Hasil ini menjadi peta belajar peserta pada tahap pembelajaran berikutnya.", { x: 0.8, y: 3.5, w: 11.5, h: 0.8, fontFace: FONT, fontSize: 16, color: "C9D7F0" });

  return { buffer: Buffer.from((await p.write({ outputType: "nodebuffer" })) as ArrayBuffer), name: perDay ? `${test.name} - ${sessions[0].label}` : test.name };
}
