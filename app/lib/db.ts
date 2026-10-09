import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _mongo?: Cache };
const cache: Cache = (g._mongo ??= { conn: null, promise: null });

async function resolveUri(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.NODE_ENV === "production") throw new Error("MONGODB_URI is required in production");
  // Dev tanpa MongoDB: pakai instance in-memory (data hilang saat server berhenti).
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  console.warn("[db] MONGODB_URI is empty, using in-memory MongoDB (dev only)");
  return mem.getUri("edulyfe_epta");
}

export async function connectDB() {
  if (cache.conn) return cache.conn;
  cache.promise ??= resolveUri().then((uri) => mongoose.connect(uri, { bufferCommands: false }));
  cache.conn = await cache.promise;
  return cache.conn;
}
