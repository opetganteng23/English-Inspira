import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { Audio } from "@/models/Audio";
import { readMp3, storeMp3 } from "@/lib/audio-upload";

const KINDS = ["short_conversation", "longer_conversation", "talk", "other"] as const;
type Kind = (typeof KINDS)[number];


export async function POST(req: Request) {
  try {
    const user = await requireRole(["admin"]);
    const form = await req.formData();
    const { buf, durationSec, sha256, name } = await readMp3(form.get("file"));
    const dup = await Audio.findOne({ sha256 }).select("_id title");
    if (dup) return NextResponse.json({ audioId: String(dup._id), deduped: true, title: dup.title });
    const gridFsId = await storeMp3(buf, name, sha256);

    const title = String(form.get("title") ?? "").trim() || name.replace(/\.mp3$/i, "");
    const audio = await Audio.create({
      gridFsId, title, size: buf.length, durationSec, sha256,
      transcript: String(form.get("transcript") ?? "") || undefined, uploaderId: user._id,
      kind: ((KINDS as readonly string[]).includes(String(form.get("kind"))) ? String(form.get("kind")) : "other") as Kind,
      description: String(form.get("description") ?? "").trim().slice(0, 500) || undefined, source: String(form.get("source") ?? "").trim().slice(0, 200) || undefined,
    });
    return NextResponse.json({ audioId: String(audio._id), durationSec }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
