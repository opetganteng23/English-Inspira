import Link from "next/link";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-3 no-underline ${dark ? "text-navy" : "text-white"}`}>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-[10px] font-display text-base font-extrabold ${
          dark ? "bg-navy text-white" : "bg-white text-navy"
        }`}
      >
        EP
      </span>
      <span className="font-display text-lg font-extrabold tracking-wide">EDULYFE EPTA</span>
    </Link>
  );
}
