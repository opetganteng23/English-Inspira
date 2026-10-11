import Link from "next/link";
import Image from "next/image";

/**
 * Logo English Inspira (MTS v2.4). `dark` = di atas latar terang: logo berwarna apa adanya.
 * Tanpa `dark` (di atas latar navy): logo di atas chip putih agar navy ENGLISH tetap terbaca.
 * Di area aplikasi, mode gelap memakai `.logo-chip` (var(--logo-bg)).
 */
export function Logo({ dark = false, size = 40 }: { dark?: boolean; size?: number; sub?: boolean }) {
  const w = Math.round(size * 600 / 243);
  return (
    <Link href="/" aria-label="English Inspira home" className={`inline-flex shrink-0 items-center no-underline ${dark ? "logo-chip px-1.5 py-1" : "rounded-xl bg-white px-2.5 py-1.5"}`}>
      <Image src="/brand/ei-full.png" alt="English Inspira" width={w} height={size} priority style={{ height: size, width: "auto" }} />
    </Link>
  );
}
