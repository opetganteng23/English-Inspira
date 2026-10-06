import mongoose from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { connectDB } from "./db";

export async function audioBucket() {
  await connectDB();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "audio" });
}

const key = () => new TextEncoder().encode(process.env.JWT_SECRET);

/** URL bertanda tangan berumur 10 menit; mengikat audio + attempt. */
export async function signAudioToken(audioId: string, attemptId: string) {
  return new SignJWT({ aud: audioId, att: attemptId, p: "audio" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(key());
}

export async function verifyAudioToken(token: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.p !== "audio") return null;
    return { audioId: payload.aud as string, attemptId: payload.att as string };
  } catch {
    return null;
  }
}
