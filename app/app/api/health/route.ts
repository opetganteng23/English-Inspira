import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Health check untuk Docker/load balancer: aplikasi hidup dan database terjangkau. Tanpa data sensitif. */
export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db!.admin().ping();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
