// Membangun dokumen srcdoc untuk materi mode "HTML Halaman" (MTS §10.3). Aman dipakai di klien maupun server.
// iframe HARUS disandbox dengan HANYA `allow-scripts allow-forms` (lihat MaterialFrame): tanpa allow-same-origin
// (skrip tidak bisa membaca cookie/storage/API aplikasi), tanpa allow-modals/popups/top-navigation.
// Komunikasi hanya lewat jembatan postMessage ber-nonce ke induk.

export type HtmlDoc = { html?: string; css?: string; js?: string };

export const SANDBOX = "allow-scripts allow-forms";

/** CSP baseline: tanpa host eksternal. Gambar/audio hanya dari origin aplikasi (aset yang diunggah) dan data:/blob:. */
export function materialCsp(origin: string) {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    `img-src data: blob: ${origin}`,
    `media-src ${origin} blob:`,
    "font-src data:",
    "connect-src 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "worker-src 'none'",
    "base-uri 'none'",
  ].join("; ");
}

export function buildSrcdoc(doc: HtmlDoc, origin: string, nonce: string) {
  if (!/^[A-Za-z0-9]{16,64}$/.test(nonce)) throw new Error("Nonce tidak valid");
  // Jembatan dijalankan pertama dan menghapus dirinya sendiri dari DOM, supaya nonce (literal di teks skrip)
  // tidak bisa dibaca skrip materi lewat document.scripts. Nonce hidup hanya di closure fungsi jembatan.
  const bridge = `<script>(function(n){
var P=window.parent,post=P.postMessage.bind(P),last=0,sent=0;
function send(t,p){post({v:1,n:n,t:t,p:p},"*");}
function height(){var h=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0));if(h!==last){last=h;send("height",{h:h});}}
var api={
 report:function(score,answers){send("report",{score:Number(score),answers:answers===undefined?null:answers});},
 complete:function(score,answers){send("complete",{score:Number(score),answers:answers===undefined?null:answers});}
};
api.progress=api.complete;
Object.defineProperty(window,"EI",{value:Object.freeze(api),writable:false,configurable:false});
addEventListener("load",height);addEventListener("resize",height);
if(window.ResizeObserver){new ResizeObserver(height).observe(document.documentElement);}else{setInterval(height,500);}
var s=document.currentScript;if(s&&s.parentNode){s.parentNode.removeChild(s);}
})(${JSON.stringify(nonce)});<\/script>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${materialCsp(origin)}">
<style>html,body{margin:0}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1C2B44;line-height:1.5;padding:16px;box-sizing:border-box}*{box-sizing:border-box}img,video{max-width:100%}</style>
${bridge}<style>${doc.css ?? ""}</style></head><body>${doc.html ?? ""}<script>${doc.js ?? ""}<\/script></body></html>`;
}

export const MAX_DOC_BYTES = 2 * 1024 * 1024;
export const docSize = (d: HtmlDoc) => (d.html?.length ?? 0) + (d.css?.length ?? 0) + (d.js?.length ?? 0);
