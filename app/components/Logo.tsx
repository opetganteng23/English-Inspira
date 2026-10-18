import Link from "next/link";
import Image from "next/image";

/** Logo English Inspira AI (lambang, nama, dan tagline ada di gambar, latar transparan). `dark` = di atas latar terang; default = di atas latar gelap, dibungkus kartu putih agar teksnya terbaca. */
export function Logo({ dark = false, className = "" }: { dark?: boolean; sub?: boolean; className?: string }) {
  const img = <Image src="/brand/logo.png" alt="English Inspira AI" width={1600} height={550} priority className="h-11 w-auto sm:h-[52px]" />;
  return (
    <Link href="/" aria-label="English Inspira AI, home" className={`inline-flex shrink-0 items-center self-start no-underline ${dark ? "" : "rounded-xl bg-white px-3 py-1.5"} ${className}`}>
      {img}
    </Link>
  );
}
