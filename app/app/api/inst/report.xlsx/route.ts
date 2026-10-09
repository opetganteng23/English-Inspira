import ExcelJS from "exceljs";
import { handleError } from "@/lib/rbac";
import { instContext, memberResults } from "@/lib/inst";
import { audit } from "@/lib/audit";
import { getLevels } from "@/lib/config";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user, inst, scoped } = await instContext(req);
    const members = await User.find(scoped()).sort({ name: 1 }).select("name email targetScore status currentLevelId currentScoreEst").lean();
    const lv = new Map((await getLevels()).map((l) => [String(l._id), l.name]));
    const results = await memberResults(members.map((m) => m._id));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Peserta");
    ws.columns = [
      { header: "Nama", key: "n", width: 28 }, { header: "Email", key: "e", width: 30 }, { header: "Target", key: "t", width: 8 }, { header: "Tes selesai", key: "c", width: 12 },
      { header: "Skor pertama", key: "f", width: 13 }, { header: "Skor terakhir", key: "l", width: 13 }, { header: "Listening", key: "li", width: 10 }, { header: "Structure", key: "st", width: 10 }, { header: "Reading", key: "re", width: 10 }, { header: "Tes terakhir", key: "d", width: 16 }, { header: "Level", key: "lv", width: 14 }, { header: "Status akun", key: "s", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const m of members) {
      const l = results.get(String(m._id)) ?? [], last = l[l.length - 1];
      const sc = (n: string) => last?.sectionScores.find((s) => s.section === n)?.scaled ?? "";
      ws.addRow({ n: m.name ?? "", e: m.email, t: m.targetScore ?? "", c: l.length, f: l[0]?.scoreEst ?? "", l: last?.scoreEst ?? "", li: sc("listening"), st: sc("structure"), re: sc("reading"), d: last?.finishedAt ? last.finishedAt.toISOString().slice(0, 10) : "", lv: m.currentLevelId ? lv.get(String(m.currentLevelId)) ?? "" : "", s: m.status === "invited" ? "menunggu aktivasi" : m.status });
    }
    await audit(user._id, "inst.report_export", String(inst._id), { rows: members.length });
    return new Response(new Uint8Array(Buffer.from(await wb.xlsx.writeBuffer())), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="laporan-${inst.code}.xlsx"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
