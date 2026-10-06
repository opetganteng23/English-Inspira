import sanitizeHtml from "sanitize-html";

// Whitelist untuk teks bacaan (passage). Tanpa script/iframe/event handler; gambar hanya dari /api/assets.
export function sanitizePassage(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "sub", "sup", "ul", "ol", "li", "blockquote", "h3", "h4", "span", "img", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { img: ["src", "alt", "width", "height"], span: ["style"], "*": [] },
    allowedStyles: { span: { "text-decoration": [/^underline$/] } },
    allowedSchemes: [],
    allowedSchemesByTag: {},
    transformTags: {
      img: (tag, attribs) => ({
        tagName: "img",
        attribs: /^\/api\/assets\/[0-9a-f]{24}$/.test(attribs.src ?? "") ? attribs : {},
      }),
    },
    exclusiveFilter: (f) => f.tag === "img" && !f.attribs.src,
  });
}

// Materi rich text: whitelist lebih luas. Audio hanya penanda data-audio-id (src disisipkan server saat tampil);
// iframe hanya untuk embed YouTube.
export function sanitizeRich(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "sub", "sup", "mark", "code", "pre", "blockquote", "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td", "span", "div", "audio", "iframe", "input", "label"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      span: ["style"], div: ["style"], p: ["style"], td: ["style", "colspan", "rowspan"], th: ["style", "colspan", "rowspan"],
      audio: ["data-audio-id", "controls"],
      iframe: ["src", "width", "height", "allowfullscreen", "title"],
      input: ["type", "checked", "disabled"], li: ["data-checked", "data-type"], ul: ["data-type"],
    },
    allowedStyles: { "*": { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/], "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/], "text-align": [/^(left|right|center|justify)$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    transformTags: {
      a: (tag, a) => ({ tagName: "a", attribs: { ...a, target: "_blank", rel: "noopener noreferrer nofollow" } }),
      img: (tag, a) => ({ tagName: "img", attribs: /^\/api\/assets\/[0-9a-f]{24}$/.test(a.src ?? "") ? a : {} }),
      input: (tag, a) => ({ tagName: "input", attribs: { type: "checkbox", disabled: "disabled", ...(a.checked !== undefined ? { checked: "checked" } : {}) } }),
      audio: (tag, a) => { const attribs: Record<string, string> = /^[0-9a-f]{24}$/.test(a["data-audio-id"] ?? "") ? { "data-audio-id": a["data-audio-id"], controls: "controls" } : {}; return { tagName: "audio", attribs }; },
    },
    exclusiveFilter: (f) => (f.tag === "img" && !f.attribs.src) || (f.tag === "audio" && !f.attribs["data-audio-id"]),
  });
}
