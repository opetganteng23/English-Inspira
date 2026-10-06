export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const s = ["Keranjang", "Checkout", "Bayar"];
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Langkah pembelian">
      {s.map((t, i) => (
        <li key={t} className={`flex items-center gap-2 ${i + 1 === current ? "font-semibold text-navy" : i + 1 < current ? "text-success" : "text-ink-soft"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i + 1 === current ? "bg-brand text-white" : i + 1 < current ? "bg-success text-white" : "bg-line text-ink-soft"}`}>{i + 1 < current ? "✓" : i + 1}</span>
          {t}{i < 2 && <span className="text-line-strong">›</span>}
        </li>
      ))}
    </ol>
  );
}
