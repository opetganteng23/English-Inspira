import { Attempt } from "@/models/Test";

/** Ruang tes mengirim heartbeat tiap 30 detik; tanpa kabar lebih dari 90 detik dianggap koneksi terputus. */
export const HEARTBEAT_SEC = 30;
export const GAP_MS = 90_000;

/**
 * Catat bahwa ruang tes masih tersambung. Bila jeda sejak kabar terakhir melebihi GAP_MS, simpan sebagai jeda koneksi.
 * Memakai updateOne (bukan doc.save) agar tidak bentrok versi dengan simpanan jawaban yang berjalan bersamaan.
 */
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
