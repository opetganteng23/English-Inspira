import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy px-6 text-center text-white">
      <Logo />
      <p className="font-display text-7xl font-extrabold text-accent">404</p>
      <h1 className="font-display text-2xl font-extrabold">Page not found</h1>
      <p className="max-w-md text-mist">The link may be wrong or the page has moved.</p>
      <Link href="/" className="btn-accent mt-2">Back to home</Link>
    </main>
  );
}
