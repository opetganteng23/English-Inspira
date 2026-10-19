// Layar penuh lintas browser: Safari lama (macOS < 13.3) hanya punya versi berawalan webkit.
type WDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type WEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function enterFullscreen() {
  const el = document.documentElement as WEl;
  try {
    if (el.requestFullscreen) return el.requestFullscreen().catch(() => {});
    el.webkitRequestFullscreen?.();
  } catch { /* layar penuh opsional */ }
  return Promise.resolve();
}
export const isFullscreen = () => !!(document.fullscreenElement ?? (document as WDoc).webkitFullscreenElement);
/** Pasang pendengar perubahan layar penuh (standar dan webkit). Mengembalikan fungsi pelepas. */
export function onFullscreenChange(fn: () => void) {
  document.addEventListener("fullscreenchange", fn);
  document.addEventListener("webkitfullscreenchange", fn);
  return () => { document.removeEventListener("fullscreenchange", fn); document.removeEventListener("webkitfullscreenchange", fn); };
}
