import { NextResponse } from "next/server";
import { seedTests } from "@/lib/seed";
import { seedDemo } from "@/lib/seed-demo";
import { getLevels } from "@/lib/config";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question, QuestionGroup } from "@/models/Question";

// Hanya untuk dev (DB in-memory tidak bisa diisi dari proses lain). Mati total di production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  await getLevels(); // pastikan level bawaan ada
  const result = { ...(await seedTests()), ...(await seedDemo()) };

  // ?audio=<audioId>: tempelkan audio ke 3 soal Listening pertama (untuk menguji sekali putar).
  const audioId = new URL(req.url).searchParams.get("audio");
  if (audioId) {
    await connectDB();
    const test = await Test.findOne({ kind: "placement" }).lean();
    const ids = test!.sections.find((s) => s.name === "listening")!.questionIds.slice(0, 3);
    const g = await QuestionGroup.create({ section: "listening", audioId, instruction: "Listen to the conversation." });
    await Question.updateMany({ _id: { $in: ids } }, { groupId: g._id });
    return NextResponse.json({ ...result, audioGroup: String(g._id) });
  }
  return NextResponse.json(result);
}
