import sanitizeHtml from "sanitize-html";
import { validBlock } from "./blocks";

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
      span: ["style"], div: ["style", "data-ei-block", "data-config", "data-topic", "data-bid", "data-ei-invalid"], p: ["style"], td: ["style", "colspan", "rowspan"], th: ["style", "colspan", "rowspan"],
      audio: ["data-audio-id", "controls", "data-transcript"],
      iframe: ["src", "width", "height", "allowfullscreen", "title"],
      input: ["type", "checked", "disabled"], li: ["data-checked", "data-type"], ul: ["data-type"],
    },
    allowedStyles: { "*": { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/], "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/], "text-align": [/^(left|right|center|justify)$/], "font-size": [/^\d{1,2}(\.\d+)?(px|pt|em|rem)$/], "font-family": [/^[\w\s,-]{1,80}$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    transformTags: {
      a: (tag, a) => ({ tagName: "a", attribs: { ...a, target: "_blank", rel: "noopener noreferrer nofollow" } }),
      img: (tag, a) => ({ tagName: "img", attribs: /^\/api\/assets\/[0-9a-f]{24}$/.test(a.src ?? "") ? a : {} }),
      input: (tag, a) => ({ tagName: "input", attribs: { type: "checkbox", disabled: "disabled", ...(a.checked !== undefined ? { checked: "checked" } : {}) } }),
      audio: (tag, a) => { const attribs: Record<string, string> = /^[0-9a-f]{24}$/.test(a["data-audio-id"] ?? "") ? { "data-audio-id": a["data-audio-id"], controls: "controls", ...(a["data-transcript"] === "1" ? { "data-transcript": "1" } : {}) } : {}; return { tagName: "audio", attribs }; },
      // Blok interaktif: konfigurasi JSON divalidasi; yang tidak sah ditandai lalu dibuang oleh exclusiveFilter.
      div: (tag, a) => {
        if (a["data-ei-block"] === undefined) { const { "data-config": _c, "data-topic": _t, "data-bid": _b, ...rest } = a; void _c; void _t; void _b; return { tagName: "div", attribs: rest }; }
        if (!validBlock(a["data-ei-block"], a["data-config"], a["data-topic"])) return { tagName: "div", attribs: { "data-ei-invalid": "1" } };
        return { tagName: "div", attribs: { "data-ei-block": a["data-ei-block"], "data-config": a["data-config"], ...(a["data-topic"] ? { "data-topic": a["data-topic"] } : {}), ...(/^[a-z0-9]{6,24}$/i.test(a["data-bid"] ?? "") ? { "data-bid": a["data-bid"] } : {}) } };
      },
    },
    exclusiveFilter: (f) => (f.tag === "img" && !f.attribs.src) || (f.tag === "audio" && !f.attribs["data-audio-id"]) || (f.tag === "div" && f.attribs["data-ei-invalid"] === "1"),
  });
}
