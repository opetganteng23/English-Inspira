"use client";

import { useState } from "react";
import { SupportForm } from "./SupportForm";
import { FaqList } from "./FaqList";
import { PARTICIPANT_FAQ } from "@/lib/faq";

const DURING = PARTICIPANT_FAQ.filter(([t]) => t === "During the test");

/**
 * Help di ruang tes: tetap di halaman yang sama (tanpa tautan keluar, tanpa tab baru yang tercatat sebagai pindah tab).
 * Timer tidak berhenti; peserta diingatkan dengan jelas. Tiket otomatis berkategori "Problem during the test" (urgent).
 */
export function TestRoomHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold" aria-haspopup="dialog">Help</button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-end bg-navy/40 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="Help during the test" onClick={() => setOpen(false)}>
          <div className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 text-ink shadow-xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-extrabold text-navy">Help during the test</h2><button onClick={() => setOpen(false)} aria-label="Close" className="text-2xl leading-none text-ink-soft">×</button></div>
            <p className="rounded-xl bg-accent-tint p-3 text-sm text-navy"><b>Your timer keeps running</b> while this window is open. Your answers are saved. Close this window to continue.</p>
            <FaqList groups={DURING} compact />
            <div className="flex flex-col gap-2">
              <h3 className="font-display font-extrabold text-navy">Still stuck? Tell our team</h3>
              <SupportForm signedIn compact defaultCategory="during_test" stayHere />
            </div>
            <button className="btn-solid self-end" onClick={() => setOpen(false)}>Back to the test</button>
          </div>
        </div>
      )}
    </>
  );
}
