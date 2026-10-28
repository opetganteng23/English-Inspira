import fs from "node:fs";
import path from "node:path";
import { Types } from "mongoose";
import { pipeline } from "node:stream/promises";
import { audioBucket } from "./audio-store";

/**
 * Cache audio di disk server. Database jauh (Atlas) membatasi laju transfer, jadi mengalirkan berkas audio dari GridFS untuk
 * tiap peserta menghabiskan jatah transfer dan membuat semua halaman lambat. Berkas diunduh SEKALI (peserta lain menunggu unduhan
 * yang sama) lalu disajikan dari disk. Kunci cache = id GridFS, yang berganti bila MP3 diganti, jadi tidak pernah basi.
 */
const dir = () => process.env.AUDIO_CACHE_DIR || path.join(process.cwd(), ".audio-cache");
const inflight = new Map<string, Promise<string | null>>();
const WAIT_MS = 90_000; // menunggu unduhan bersama selama ini; lewat itu, langsung alirkan dari database

const fileFor = (gridFsId: string) => path.join(dir(), `${gridFsId}.mp3`);

async function download(gridFsId: string, size: number): Promise<string | null> {
  const final = fileFor(gridFsId), tmp = `${final}.${process.pid}.part`;
  try {
    await fs.promises.mkdir(dir(), { recursive: true });
    await pipeline((await audioBucket()).openDownloadStream(new Types.ObjectId(gridFsId)), fs.createWriteStream(tmp));
    if ((await fs.promises.stat(tmp)).size !== size) throw new Error("size mismatch");
    await fs.promises.rename(tmp, final);
    return final;
  } catch (e) {
    console.error("[audio-cache] gagal menyimpan", gridFsId, (e as Error).message);
    await fs.promises.rm(tmp, { force: true }).catch(() => {});
    return null;
  }
}

/** Jalur berkas cache untuk audio ini, atau null bila belum bisa disiapkan (pemanggil lalu mengalirkan dari database). */
export async function cachedAudioFile(gridFsId: string, size: number): Promise<string | null> {
  const p = fileFor(gridFsId);
  try { if ((await fs.promises.stat(p)).size === size) return p; } catch { /* belum ada */ }
  let job = inflight.get(gridFsId);
  if (!job) { job = download(gridFsId, size).finally(() => inflight.delete(gridFsId)); inflight.set(gridFsId, job); }
  return Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS))]);
}
