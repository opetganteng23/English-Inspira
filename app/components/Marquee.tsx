/** Teks atau logo berjalan. CSS murni: berhenti saat disorot kursor, dan statis bila "reduce motion" aktif. */
export function TextMarquee({ items, reverse = false, tone = "navy" }: { items: string[]; reverse?: boolean; tone?: "navy" | "gold" | "light" }) {
  if (!items.length) return null;
  const list = Array.from({ length: Math.max(8, items.length * 2) }, (_, i) => items[i % items.length]);
  const colors = tone === "navy" ? "bg-navy text-white" : tone === "gold" ? "bg-accent text-navy" : "border-y border-line bg-white text-navy";
  const group = (hidden: boolean) => (
    <ul className="marquee-group" aria-hidden={hidden || undefined}>
      {list.map((t, i) => (
        <li key={i} className="flex items-center gap-8 whitespace-nowrap font-display text-sm font-extrabold uppercase tracking-[0.18em] sm:text-base">
          <span>{t}</span>
          <span className="h-1.5 w-1.5 rotate-45 bg-current opacity-70" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee ${colors} py-3.5`} role="region" aria-label="Highlights">
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`}>{group(false)}{group(true)}</div>
    </div>
  );
}

export function LogoMarquee({ partners, label }: { partners: { name: string; logoId: string }[]; label?: string }) {
  if (!partners.length) return null;
  const list = Array.from({ length: Math.max(8, partners.length * 2) }, (_, i) => partners[i % partners.length]);
  const group = (hidden: boolean) => (
    <ul className="marquee-group" aria-hidden={hidden || undefined}>
      {list.map((p, i) => (
        <li key={i} className="flex h-14 items-center">
          {p.logoId
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/assets/${p.logoId}`} alt={p.name} className="h-10 w-auto max-w-[180px] object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-12" loading="lazy" />
            : <span className="whitespace-nowrap font-display text-xl font-bold text-navy/80 transition hover:text-brand sm:text-2xl">{p.name}</span>}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="border-y border-line bg-[#EEF2F7] py-5">
      {label && <p className="mb-2 text-center text-xs font-semibold tracking-[0.2em] text-ink-soft">{label}</p>}
      <div className="marquee" role="region" aria-label="Partners">
        <div className="marquee-track marquee-slow">{group(false)}{group(true)}</div>
      </div>
    </div>
  );
}
