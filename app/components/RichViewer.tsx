"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import DOMPurify from "dompurify";
import { InteractiveBlock } from "./InteractiveBlocks";
import { BLOCK_TYPES, TOPIC_RE, type BlockType } from "@/lib/blocks";

// Pertahanan klien (MTS §10.2): sanitasi ulang dengan DOMPurify sebelum HTML materi dimasukkan ke DOM.
// Daftar mengikuti whitelist server (lib/sanitize.ts); iframe hanya YouTube.
const TAGS = ["h1", "h2", "h3", "h4", "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "sub", "sup", "mark", "code", "pre", "blockquote", "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td", "span", "div", "audio", "iframe", "input", "label", "details", "summary"];
const ATTRS = ["href", "target", "rel", "src", "alt", "width", "height", "style", "colspan", "rowspan", "controls", "controlslist", "allowfullscreen", "title", "type", "checked", "disabled", "data-audio-id", "data-transcript", "data-checked", "data-type", "data-ei-block", "data-config", "data-topic", "data-bid"];

let hooked = false;
export function sanitizeClient(html: string) {
  if (!hooked) {
    hooked = true;
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.nodeName === "IFRAME" && !/^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//.test(node.getAttribute("src") ?? "")) node.parentNode?.removeChild(node);
      if (node.nodeName === "A") { node.setAttribute("target", "_blank"); node.setAttribute("rel", "noopener noreferrer nofollow"); }
    });
  }
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false, FORBID_TAGS: ["script", "style", "form", "object", "embed"], ADD_TAGS: ["iframe"] });
}

/**
 * Penampil rich text. Menghidrasi blok interaktif (data-ei-block) menjadi komponen React; hasil tiap butir dikirim ke
 * /api/events/block (hanya bila materialId diberikan, mis. bukan pratinjau admin).
 */
export function RichViewer({ html, materialId }: { html: string; materialId?: string }) {
  const [clean, setClean] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setClean(sanitizeClient(html)); }, [html]);

  useEffect(() => {
    const host = box.current;
    if (clean === null || !host) return;
    const roots: ReturnType<typeof createRoot>[] = [];
    host.querySelectorAll<HTMLElement>("[data-ei-block]").forEach((el, n) => {
      const type = el.getAttribute("data-ei-block") as BlockType;
      let config: unknown;
      try { config = JSON.parse(el.getAttribute("data-config") ?? ""); } catch { return; }
      if (!(BLOCK_TYPES as readonly string[]).includes(type)) return;
      const topic = el.getAttribute("data-topic") ?? "";
      const bid = el.getAttribute("data-bid") ?? `b${n}`;
      const report = (itemId: string, correct: boolean) => {
        if (!materialId || !TOPIC_RE.test(topic)) return;
        fetch("/api/events/block", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId, blockId: bid.replace(/[^A-Za-z0-9]/g, "").slice(0, 24) || `b${n}`, itemId, topic, correct }) }).catch(() => {});
      };
      el.textContent = ""; // buang ringkasan teks cadangan
      const root = createRoot(el);
      root.render(<InteractiveBlock type={type} config={config} report={report} />);
      roots.push(root);
    });
    return () => { setTimeout(() => roots.forEach((r) => r.unmount())); };
  }, [clean, materialId]);

  if (clean === null) return <div className="h-40 animate-pulse rounded-xl bg-canvas" aria-label="Loading material" />;
  return <div ref={box} className="prose-ei" dangerouslySetInnerHTML={{ __html: clean }} />;
}
