"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SupportForm } from "./SupportForm";

/** Tombol Help mengambang (8.1): FAQ, kirim permintaan bantuan, dan permintaan saya. Di semua halaman peserta, institusi, dan coach. */
export function HelpButton({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Help"
        className="fixed bottom-4 right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white shadow-lg hover:bg-brand md:bottom-6 md:right-6">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
        Help
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-navy/30 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Help" onClick={() => setOpen(false)}>
          <div className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-extrabold text-navy">How can we help?</h2><button onClick={() => setOpen(false)} aria-label="Close" className="text-2xl leading-none text-ink-soft">×</button></div>
            <div className="flex flex-wrap gap-2 text-sm">
              {role === "participant" && <Link href="/help" className="btn-outline !min-h-[36px]">Read the FAQ</Link>}
              <Link href="/support" className="btn-outline !min-h-[36px]">My requests</Link>
            </div>
            <SupportForm signedIn compact />
          </div>
        </div>
      )}
    </>
  );
}
