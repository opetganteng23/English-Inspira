import { z } from "zod";
import { HttpError } from "./rbac";
import { sanitizeRich } from "./sanitize";
import { docSize, MAX_DOC_BYTES } from "./material-doc";

export const materialInput = z.object({
  title: z.string().trim().min(1).max(150),
  summary: z.string().max(400).optional(),
  kind: z.enum(["rich", "html"]),
  contentJson: z.unknown().optional(),
  contentHtml: z.string().max(500_000).optional(),
  htmlDoc: z.object({ html: z.string().optional(), css: z.string().optional(), js: z.string().optional() }).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  access: z.enum(["free", "paid"]).default("paid"),
});

export function normalizeMaterial(b: z.infer<typeof materialInput>) {
  if (b.kind === "html") {
    if (!b.htmlDoc || docSize(b.htmlDoc) === 0) throw new HttpError(400, "Isi HTML materi kosong");
    if (docSize(b.htmlDoc) > MAX_DOC_BYTES) throw new HttpError(413, "Dokumen materi maksimal 2 MB");
    return { ...b, contentJson: undefined, contentHtml: undefined };
  }
  return { ...b, htmlDoc: undefined, contentHtml: sanitizeRich(b.contentHtml ?? "") }; // sanitasi wajib saat simpan
}

