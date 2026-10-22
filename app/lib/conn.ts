import { Attempt } from "@/models/Test";

/** Ruang tes mengirim heartbeat tiap 30 detik; tanpa kabar lebih dari 90 detik dianggap koneksi terputus. */
export const HEARTBEAT_SEC = 30;
export const GAP_MS = 90_000;

/**
 * Catat bahwa ruang tes masih tersambung. Bila jeda sejak kabar terakhir melebihi GAP_MS, simpan sebagai jeda koneksi.
 * Memakai updateOne (bukan doc.save) agar tidak bentrok versi dengan simpanan jawaban yang berjalan bersamaan.
 */
/** Kompensasi waktu: jeda koneksi lebih dari 70 detik dikembalikan (dikurangi interval heartbeat), maks 10 menit per bagian. */
export const CREDIT_MIN_GAP_MS = 70_000;
export const CREDIT_CAP_SEC = 600;

/**
 * Peserta kembali tersambung setelah koneksi putus: tambahkan lama jeda ke batas waktu bagian yang sedang dikerjakan
 * (soal disembunyikan di layar selama offline, jadi jeda tidak bisa dipakai mengerjakan). Dipanggil SEBELUM touchConn dan syncTimer.
 */
export async function creditGap(a: { _id: unknown; status?: string; sectionIdx?: number | null; timeCredits?: number[] | null; conn?: { lastSeenAt?: Date | null } | null }) {
  const last = a.conn?.lastSeenAt;
  if (a.status !== "in_progress" || !last) return 0;
  const gapMs = Date.now() - +last;
  if (gapMs <= CREDIT_MIN_GAP_MS) return 0;
  const idx = a.sectionIdx ?? 0;
  const arr = [...(a.timeCredits ?? [])];
  while (arr.length <= idx) arr.push(0);
  const add = Math.min(Math.round((gapMs - HEARTBEAT_SEC * 1000) / 1000), CREDIT_CAP_SEC - arr[idx]);
  if (add <= 0) return 0;
  arr[idx] += add;
  await Attempt.updateOne({ _id: a._id as never, status: "in_progress" }, { $set: { timeCredits: arr } });
  a.timeCredits = arr;
  return add;
}

export async function touchConn(a: { _id: unknown; sectionIdx?: number | null; conn?: { lastSeenAt?: Date | null } | null }, opts: { load?: boolean } = {}) {
  const now = new Date(), last = a.conn?.lastSeenAt;
  const gap = last && +now - +last > GAP_MS;
  await Attempt.updateOne(
    { _id: a._id as never, status: "in_progress" },
    {
      $set: { "conn.lastSeenAt": now },
      ...(opts.load ? { $inc: { "conn.loads": 1 } } : {}),
      ...(gap ? { $push: { "conn.gaps": { $each: [{ from: last, to: now, section: a.sectionIdx ?? 0 }], $slice: -50 } } } : {}),
    },
  ).catch(() => {});
}
