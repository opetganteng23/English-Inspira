import type { FaqGroup } from "@/lib/faq";

/** Daftar FAQ yang bisa dibuka-tutup; dipakai di halaman FAQ, Help & support, dan ruang tes. */
export function FaqList({ groups, compact }: { groups: FaqGroup[]; compact?: boolean }) {
  return (
    <>
      {groups.map(([title, items]) => (
        <section key={title} className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
          <h2 className={`font-display font-extrabold text-navy ${compact ? "text-base" : "text-lg"}`}>{title}</h2>
          {items.map(([q, a]) => (
            <details key={q} className="group card !p-0"><summary className={`flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-navy ${compact ? "p-3 text-sm" : "p-4"}`}>{q}<span className="text-xl text-brand group-open:hidden">+</span><span className="hidden text-xl text-brand group-open:inline">−</span></summary><p className={`text-sm leading-relaxed text-ink-soft ${compact ? "px-3 pb-3" : "px-4 pb-4"}`}>{a}</p></details>
          ))}
        </section>
      ))}
    </>
  );
}
