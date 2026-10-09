// Kompres di klien sebelum upload: sisi terpanjang <=1280 px, WebP/JPEG kualitas turun bertahap sampai <=maxBytes.
export async function compressImage(file: File, maxBytes = 300 * 1024) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);

  const type = canvas.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  let quality = 0.8, blob: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
    if (blob && blob.size <= maxBytes) break;
    quality -= 0.12;
  }
  if (!blob || blob.size > maxBytes) throw new Error("Image still too large after compression");
  return { blob, width: w, height: h };
}

export async function uploadImage(file: File, opts: { sensitive?: boolean } = {}) {
  const { blob, width, height } = await compressImage(file, opts.sensitive ? 500 * 1024 : 300 * 1024);
  const fd = new FormData();
  fd.append("file", blob, "image");
  fd.append("width", String(width));
  fd.append("height", String(height));
  if (opts.sensitive) fd.append("sensitive", "true");
  const r = await fetch("/api/assets", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Upload failed");
  return data as { id: string; url: string };
}
