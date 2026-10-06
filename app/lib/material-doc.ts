// Membangun dokumen srcdoc untuk materi mode "HTML Halaman". Aman dipakai di klien maupun server.
// iframe HARUS disandbox TANPA allow-same-origin (lihat MaterialFrame), sehingga skrip materi tidak bisa membaca cookie
// atau memanggil API aplikasi sebagai pengguna. Komunikasi hanya lewat postMessage ke induk.

export type HtmlDoc = { html?: string; css?: string; js?: string };

export function buildSrcdoc(doc: HtmlDoc, origin: string) {
  // Origin aplikasi diizinkan untuk gambar/audio karena iframe beropaque origin: 'self' tidak cocok dengan origin asli.
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    `img-src data: blob: ${origin}`,
    `media-src ${origin} blob:`,
    "font-src https://fonts.gstatic.com data:",
    "connect-src 'none'",
    "form-action 'none'",
  ].join("; ");

  // Skrip pengukur tinggi + jembatan progres. Dijalankan sebelum skrip materi.
  const bridge = `<script>(function(){
var last=0;function send(){var h=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0));if(h!==last){last=h;parent.postMessage({__ei:"height",h:h},"*");}}
window.EI={progress:function(score,answers){parent.postMessage({__ei:"progress",score:Number(score),answers:answers===undefined?null:answers},"*");}};
addEventListener("load",send);addEventListener("resize",send);
if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement);}else{setInterval(send,500);}
})();<\/script>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>html,body{margin:0}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1C2B44;line-height:1.5;padding:16px;box-sizing:border-box}*{box-sizing:border-box}img,video{max-width:100%}</style>
<style>${doc.css ?? ""}</style></head><body>${doc.html ?? ""}${bridge}<script>${doc.js ?? ""}<\/script></body></html>`;
}

export const MAX_DOC_BYTES = 2 * 1024 * 1024;
export const docSize = (d: HtmlDoc) => (d.html?.length ?? 0) + (d.css?.length ?? 0) + (d.js?.length ?? 0);
