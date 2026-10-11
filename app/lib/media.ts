import type { Types } from "mongoose";
import { Question, QuestionGroup } from "@/models/Question";
import { Material } from "@/models/Material";
import { Course } from "@/models/Course";
import { Setting } from "@/models/Settings";

export type Usage = { kind: "question" | "passage" | "material" | "course" | "settings"; count: number };

/** Di mana saja gambar dipakai. Dipakai Media Library untuk menahan penghapusan gambar yang masih terpasang. */
export async function assetUsage(ids: (Types.ObjectId | string)[]) {
  const out = new Map<string, Usage[]>(ids.map((i) => [String(i), []]));
  if (!ids.length) return out;
  const sids = ids.map(String);
  const add = (id: string, kind: Usage["kind"]) => {
    const list = out.get(id);
    if (!list) return;
    const hit = list.find((u) => u.kind === kind);
    if (hit) hit.count++; else list.push({ kind, count: 1 });
  };
  const [qs, gs, ms, cs, settings] = await Promise.all([
    Question.find({ assetIds: { $in: ids } }).select("assetIds").lean(),
    QuestionGroup.find({ assetIds: { $in: ids } }).select("assetIds").lean(),
    // Materi: lampiran terdaftar, atau gambar yang tertanam di isi (rich text) lewat URL /api/assets/<id>.
    Material.find({ $or: [{ assetIds: { $in: ids } }, { contentHtml: { $regex: sids.join("|") } }, { "htmlDoc.html": { $regex: sids.join("|") } }] }).select("assetIds contentHtml htmlDoc").lean(),
    Course.find({ coverAssetId: { $in: ids } }).select("coverAssetId").lean(),
    Setting.find().select("key value").lean(),
  ]);
  for (const q of qs) for (const a of q.assetIds ?? []) add(String(a), "question");
  for (const g of gs) for (const a of g.assetIds ?? []) add(String(a), "passage");
  for (const m of ms) {
    const text = `${m.contentHtml ?? ""} ${(m as { htmlDoc?: { html?: string } }).htmlDoc?.html ?? ""}`;
    for (const id of sids) if ((m.assetIds ?? []).some((a) => String(a) === id) || text.includes(id)) add(id, "material");
  }
  for (const c of cs) if (c.coverAssetId) add(String(c.coverAssetId), "course");
  for (const s of settings) {
    const json = JSON.stringify(s.value ?? {});
    for (const id of sids) if (json.includes(id)) add(id, "settings");
  }
  return out;
}
