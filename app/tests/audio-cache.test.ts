import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Cache audio di disk: diunduh sekali dari database, lalu disajikan dari disk. MongoDB in-memory.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "audio-cache-test-"));
afterAll(async () => { await mem?.stop(); fs.rmSync(tmp, { recursive: true, force: true }); });

describe.skipIf(!safe)("cache audio (database in-memory)", () => {
  it("unduh sekali bersama, sajikan dari disk, tolak ukuran yang tidak cocok", async () => {
    process.env.AUDIO_CACHE_DIR = tmp;
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("audio_cache_test");
    const { audioBucket } = await import("@/lib/audio-store");
    const { cachedAudioFile } = await import("@/lib/audio-cache");
    const data = Buffer.from(Array.from({ length: 300_000 }, (_, i) => i % 251));
    const bucket = await audioBucket();
    const up = bucket.openUploadStream("a.mp3");
    await new Promise<void>((res, rej) => { up.on("finish", () => res()); up.on("error", rej); up.end(data); });
    const id = String(up.id);

    // Dua permintaan bersamaan memakai satu unduhan yang sama dan menghasilkan berkas yang sama persis.
    const [a, b] = await Promise.all([cachedAudioFile(id, data.length), cachedAudioFile(id, data.length)]);
    expect(a).toBe(b);
    expect(fs.readFileSync(a!).equals(data)).toBe(true);
    expect(fs.readdirSync(tmp).filter((f) => f.endsWith(".part"))).toEqual([]); // tidak ada berkas setengah jadi

    // Setelah tersimpan, berkas disajikan dari disk walau berkas di database sudah tidak ada.
    await bucket.delete(up.id);
    expect(await cachedAudioFile(id, data.length)).toBe(a);

    // Ukuran yang tidak cocok (berkas berubah) tidak dipakai, dan unduhan yang gagal tidak meninggalkan sisa.
    const up2 = bucket.openUploadStream("b.mp3");
    await new Promise<void>((res, rej) => { up2.on("finish", () => res()); up2.on("error", rej); up2.end(Buffer.alloc(1000, 1)); });
    expect(await cachedAudioFile(String(up2.id), 999)).toBeNull();
    expect(fs.readdirSync(tmp).filter((f) => f.endsWith(".part"))).toEqual([]);
  }, 120_000);
});
