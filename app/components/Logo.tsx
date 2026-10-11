import Link from "next/link";
import Image from "next/image";

/** Logo English Inspira (lambang + nama + tagline sudah ada di gambar). `dark` = di atas latar terang; default = di atas latar navy, dibungkus kartu putih agar tetap terbaca. */
export function Logo({ dark = false, className = "" }: { dark?: boolean; sub?: boolean; className?: string }) {
  const img = <Image src="/brand/logo.png" alt="English Inspira" width={1000} height={420} priority className="h-11 w-auto sm:h-14" />;
  return (
    <Link href="/" aria-label="English Inspira, home" className={`inline-flex shrink-0 items-center self-start no-underline ${dark ? "" : "rounded-xl bg-white px-3 py-1.5"} ${className}`}>
      {img}
    </Link>
  );
}
