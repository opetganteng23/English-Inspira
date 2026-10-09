import Link from "next/link";
import Image from "next/image";

/** Logo Inspira + nama produk. `dark` = di atas latar terang (logo navy). */
export function Logo({ dark = false, sub = true }: { dark?: boolean; sub?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-3 no-underline ${dark ? "text-navy" : "text-white"}`}>
      <Image src={dark ? "/brand/logo-navy.png" : "/brand/logo-white.png"} alt="" width={51} height={28} priority className="h-7 w-auto" />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-extrabold tracking-wide">ENGLISH INSPIRA</span>
        {sub && <span className={`text-[11px] font-normal ${dark ? "text-ink-soft" : "text-mist"}`}>by Inspira Teknologi</span>}
      </span>
    </Link>
  );
}
