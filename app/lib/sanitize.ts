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
