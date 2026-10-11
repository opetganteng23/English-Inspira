/** Hitung bentuk gelombang (maks `bins` angka 0-100) dari berkas audio di browser. Mengembalikan null bila tidak bisa dibaca. */
export async function computePeaks(data: Blob | ArrayBuffer, bins = 160): Promise<number[] | null> {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    try {
      const buf = await ctx.decodeAudioData(data instanceof Blob ? await data.arrayBuffer() : data.slice(0));
      const ch = buf.getChannelData(0);
      const step = Math.max(1, Math.floor(ch.length / bins));
      const peaks: number[] = [];
      for (let i = 0; i < bins; i++) {
        let max = 0;
        const from = i * step, to = Math.min(ch.length, from + step);
        for (let j = from; j < to; j += Math.max(1, Math.floor(step / 64))) max = Math.max(max, Math.abs(ch[j]));
        peaks.push(max);
      }
      const top = Math.max(...peaks, 0.0001);
      return peaks.map((p) => Math.round((p / top) * 100));
    } finally { void ctx.close(); }
  } catch { return null; }
}

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
