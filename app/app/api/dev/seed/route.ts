import { NextResponse } from "next/server";
import { seedTrial } from "@/lib/seed";
import { seedCommerce } from "@/lib/seed-commerce";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { Question, QuestionGroup } from "@/models/Question";

// Hanya untuk dev (DB in-memory tidak bisa diisi dari proses lain). Mati total di production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const result = { ...(await seedTrial()), ...(await seedCommerce()) };

  // ?audio=<audioId>: tempelkan audio ke 3 soal Listening pertama (untuk menguji sekali putar).
  const audioId = new URL(req.url).searchParams.get("audio");
  if (audioId) {
    await connectDB();
    const test = await Test.findOne({ kind: "trial" }).lean();
    const ids = test!.sections.find((s) => s.name === "listening")!.questionIds.slice(0, 3);
    const g = await QuestionGroup.create({ section: "listening", audioId, instruction: "Listen to the conversation." });
    await Question.updateMany({ _id: { $in: ids } }, { groupId: g._id });
    return NextResponse.json({ ...result, audioGroup: String(g._id) });
  }
  return NextResponse.json(result);
}
