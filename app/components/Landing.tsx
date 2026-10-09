import Link from "next/link";
import { Logo } from "./Logo";
import { PublicFooter } from "./PublicShell";

// Landing publik (desain "English Inspira Redesign"). Tanpa harga, pendaftaran, atau free trial:
// akses hanya lewat institusi mitra, jadi CTA = Sign in + kontak untuk institusi.

const Check = ({ color = "#1D6B3F" }: { color?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);

const Eyebrow = ({ children, className = "text-accent-dark" }: { children: React.ReactNode; className?: string }) => (
  <span className={`text-sm font-semibold tracking-[1.5px] ${className}`}>{children}</span>
);

const STEPS = [
  { n: 1, bg: "bg-brand", t: "ITP-format test", d: "A placement test sets your level. Listening, Structure & Written Expression, and Reading with real section timers." },
  { n: 2, bg: "bg-brand", t: "Results + AI analysis", d: "Estimated score, score per section, and your error patterns per question type." },
  { n: 3, bg: "bg-success", t: "Learn and get coached", d: "A study plan built from your results, courses for your level, the AI Counselor, and sessions with a coach." },
  { n: 4, bg: "bg-accent-dark", t: "Official ITP registration", d: "When your simulation score reaches your target, register for the official test right here." },
];

const PHASES = [
  { no: "01", name: "Discover", tag: "Know where you stand", tool: "Placement test", desc: "An ITP-format test gives your starting score per section and per question type." },
  { no: "02", name: "Learn", tag: "Learn with purpose", tool: "Courses", desc: "Courses, units, and interactive materials matched to your level." },
  { no: "03", name: "Analyze", tag: "Turn results into insight", tool: "AI analysis", desc: "AI analysis explains your error patterns and the reasons behind your score." },
  { no: "04", name: "Improve", tag: "Focus on what matters most", tool: "Study plan", desc: "A study plan and coaching sessions focused on the section furthest from your target." },
  { no: "05", name: "Experience", tag: "Simulate the real test", tool: "Simulation", desc: "A full simulation with section timers, audio played once, and test-room monitoring." },
  { no: "06", name: "Measure", tag: "Validate readiness", tool: "Progress", desc: "Track your progress per section and see when you are ready for the official test." },
  { no: "07", name: "Certify", tag: "Achieve your goal", tool: "Official ITP", desc: "Take the official TOEFL ITP on a scheduled date and receive your certificate." },
];

const AUDIENCE = [
  ["High school students", "Preparing for graduation, scholarships, and further study."],
  ["University students", "Graduation requirements, master's programs, and scholarships."],
  ["Professionals", "Recruitment requirements, promotions, and global careers."],
  ["Government agencies", "Competency development for civil servants and officials."],
  ["Companies", "Mapping your employees' English proficiency."],
  ["Campuses & schools", "Measuring and improving the quality of graduates."],
];

const FAQ = [
  ["Is this the same as the official TOEFL ITP?", "Our tests follow the TOEFL ITP format (Listening, Structure & Written Expression, Reading) and give an estimated score. Official scores only come from the official TOEFL ITP, which you can register for here when your institution's program includes it."],
  ["How do I get access?", "Access is provided through partner institutions. Your institution invites you by email, and you sign in with a one-time code sent to that email. There is no password to remember."],
  ["What can I ask the AI Counselor?", "Anything about your results: why a section score is low, what to do this week, how long until you reach your target, or whether you are ready for the official test."],
  ["What device do I need?", "A laptop or PC with headphones and a stable connection. The test room runs in fullscreen, and leaving the test tab is recorded."],
  ["Is my data safe?", "Your data is used only for your learning and your institution's reports. The AI receives scores and answers without your name or contact details. You can download your data or request deletion from your profile."],
  ["My sign-in code does not work. What should I do?", "Use the code from the newest email. The code is shown in the email subject and is valid for 5 minutes. If it expires, request a new one."],
  ["My institution wants to join. How?", "Contact us using the details at the bottom of this page. We will set up your institution, participant seats, and test schedules."],
];

export function Landing({ email, whatsapp }: { email?: string; whatsapp?: string }) {
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent("English Inspira for our institution")}` : whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "https://inspiratekno.com";
  return (
    <div className="bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Logo dark />
          <nav className="hidden items-center gap-7 text-[15px] font-medium lg:flex" aria-label="Sections">
            <a href="#how" className="text-ink hover:text-brand">How it works</a>
            <a href="#counselor" className="text-ink hover:text-brand">AI Counselor</a>
            <a href="#journey" className="text-ink hover:text-brand">Journey</a>
            <a href="#institutions" className="text-ink hover:text-brand">For institutions</a>
            <a href="#faq" className="text-ink hover:text-brand">FAQ</a>
          </nav>
          <Link href="/masuk" className="btn-solid !min-h-[44px] !px-5">Sign in</Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:flex-row lg:gap-16 lg:px-10 lg:py-24">
            <div className="flex flex-1 flex-col gap-7">
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-brand-tint px-3.5 py-2 text-[13px] font-semibold text-brand-dark">
                <span className="h-2 w-2 rounded-full bg-accent" />TOEFL ITP Preparation Program 2026
              </span>
              <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-[58px]">Know your TOEFL ITP score. Know what to do next.</h1>
              <p className="max-w-xl text-lg leading-relaxed text-[#3B4A60] sm:text-[19px]">ITP-format tests, AI analysis for every section, and an AI Counselor that plans your next steps, until you are ready to register for the official TOEFL ITP.</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/masuk" className="inline-flex h-14 items-center justify-center rounded-xl bg-brand px-7 text-[17px] font-semibold text-white hover:bg-brand-dark">Sign in</Link>
                <a href="#institutions" className="inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] border-line-strong bg-white px-7 text-[17px] font-semibold text-navy hover:border-brand">For institutions</a>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                <span>Access through your institution</span><span className="text-line-strong" aria-hidden>|</span><span>Sign in with an email code</span><span className="text-line-strong" aria-hidden>|</span><span>Official ITP registration</span>
              </div>
            </div>
            <div className="flex w-full max-w-[520px] shrink-0 flex-col gap-4 rounded-[20px] bg-navy p-6 text-white shadow-[0_30px_60px_-30px_rgba(15,47,94,0.55)]" aria-label="Example result and counseling">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold tracking-wider text-[#B9CBE6]">EXAMPLE RESULT &amp; COUNSELING</span>
                <span className="rounded-full bg-[#1E4A86] px-2.5 py-1 text-xs text-[#DCE7F7]">Target 550</span>
              </div>
              <div className="flex items-end gap-3.5">
                <span className="font-display text-[56px] font-extrabold leading-none">497</span>
                <span className="pb-1.5 text-sm text-[#B9CBE6]">Estimated ITP score · scale 310-677</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["Listening", "49", "bg-navy-700", "text-[#B9CBE6]"], ["Structure", "51", "bg-[#5A3A12]", "text-[#FFD9AE]"], ["Reading", "49", "bg-navy-700", "text-[#B9CBE6]"]].map(([l, v, bg, fg]) => (
                  <div key={l} className={`flex flex-col gap-0.5 rounded-[10px] p-2.5 ${bg}`}><span className={`text-xs ${fg}`}>{l}</span><span className="text-xl font-semibold">{v}</span></div>
                ))}
              </div>
              <div className="max-w-[360px] self-end rounded-[14px_4px_14px_14px] bg-brand px-3.5 py-3 text-sm leading-normal">What should I do to reach 550?</div>
              <div className="flex gap-2.5">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-success-tint text-[11px] font-semibold text-success">AI</span>
                <div className="rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed text-ink">You are about 53 points short. The fastest gains are in Structure: 5 of your 7 mistakes were subject-verb agreement. Practice 20 questions a day, then retest in 2 weeks.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Mitra */}
        <section className="border-y border-line bg-[#EEF2F7]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-7 text-center sm:px-6 lg:flex-row lg:px-10 lg:text-left">
            <span className="text-sm font-medium text-ink-soft">Developed and owned by</span>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-2">
              {["Inspira Teknologi", "Telkom University", "CoE AILO"].map((n) => <span key={n} className="font-display text-lg font-bold text-navy sm:text-xl">{n}</span>)}
            </div>
            <span className="max-w-[300px] text-[13px] text-ink-soft lg:text-right">Center of Excellence Artificial Intelligence for Learning and Optimization</span>
          </div>
        </section>

        {/* Cara kerja */}
        <section id="how" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-12 px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-10">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>HOW IT WORKS</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Test, understand, act, measure again.</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-[#3B4A60]">Every test result comes with an explanation and concrete steps, then gets measured again so you know whether the approach is working.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-7">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white ${s.bg}`}>{s.n}</span>
                <span className="text-xl font-semibold text-navy">{s.t}</span>
                <span className="text-[15px] leading-relaxed text-ink-soft">{s.d}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Konselor AI */}
        <section id="counselor" className="scroll-mt-20 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-20 sm:px-6 lg:flex-row lg:gap-[72px] lg:px-10 lg:py-28">
            <div className="flex flex-1 flex-col gap-6">
              <Eyebrow className="text-success">AI COUNSELOR</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">More than a score. Someone to explain it and guide you.</h2>
              <p className="text-[17px] leading-relaxed text-[#3B4A60]">Developed with CoE AILO Telkom University. The AI Counselor reads all your test results, including your answer to each question and the time you spent.</p>
              <ul className="flex flex-col gap-3.5 text-base">
                {["Explains why each section score is what it is", "Builds a plan that fits the time you have", "An action plan you can tick off, with email reminders", "Tells you when you are ready to register for the official test"].map((t) => <li key={t} className="flex gap-3"><Check /><span>{t}</span></li>)}
              </ul>
            </div>
            <div className="flex w-full max-w-[560px] shrink-0 flex-col gap-3.5 rounded-[20px] border border-line bg-canvas p-6" aria-label="Example conversation">
              <div className="flex gap-2.5"><span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-success-tint text-[11px] font-semibold text-success">AI</span><div className="rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed">Your Reading score is 49. The issue is time: the last 4 questions were unanswered because you ran out of time on the third passage.</div></div>
              <div className="max-w-[380px] self-end rounded-[14px_4px_14px_14px] bg-brand px-3.5 py-3 text-sm leading-normal text-white">I only have 30 minutes a day.</div>
              <div className="flex gap-2.5"><span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-success-tint text-[11px] font-semibold text-success">AI</span><div className="rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed">That works. 15 minutes of Structure, then 15 minutes on one Reading passage with a timer. Listening twice a week is enough. We will move your next test back by 1 week.</div></div>
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#A9D8BC] bg-white px-3.5 py-3 text-[13px] text-[#164F2F]"><Check color="#1D6B3F" /><span>Study plan updated · reminder every Monday</span></div>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-12 px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-10">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>ENGLISH INTELLIGENCE JOURNEY</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Seven stages. One complete journey.</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-[#3B4A60]">Your institution’s program decides which stages are open to you. Everything is in one account.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PHASES.map((p) => (
              <div key={p.no} className="flex min-h-[196px] flex-col gap-2.5 rounded-2xl border border-line bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold tracking-wider text-ink-soft">PHASE {p.no}</span>
                  <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-dark">{p.tool}</span>
                </div>
                <span className="font-display text-2xl font-extrabold text-navy">{p.name}</span>
                <span className="text-[15px] font-semibold text-accent-dark">{p.tag}</span>
                <span className="text-sm leading-relaxed text-ink-soft">{p.desc}</span>
              </div>
            ))}
            <div className="flex min-h-[196px] flex-col justify-between gap-4 rounded-2xl bg-navy p-6">
              <span className="font-display text-[22px] font-extrabold leading-snug text-white">Already invited by your institution?</span>
              <Link href="/masuk" className="inline-flex h-11 items-center self-start rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-navy hover:bg-[#F59A38]">Sign in</Link>
            </div>
          </div>
        </section>

        {/* Institusi */}
        <section id="institutions" className="scroll-mt-20 bg-navy text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-20 sm:px-6 lg:flex-row lg:gap-16 lg:px-10 lg:py-24">
            <div className="flex flex-1 flex-col gap-6">
              <Eyebrow className="text-[#FFC78A]">FOR INSTITUTIONS</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-[42px]">Campuses, agencies &amp; companies.</h2>
              <p className="max-w-xl text-[17px] leading-relaxed text-mist">English Inspira is provided through partner institutions. You run the program for your participants; we provide the tests, the analysis, and the learning path.</p>
              <div className="max-w-xl overflow-hidden rounded-[14px] border border-[#2A5591]">
                <div className="grid grid-cols-3 bg-navy-700 px-5 py-3.5 text-[13px] font-semibold text-[#B9CBE6]"><span>Section</span><span>Questions</span><span>Time</span></div>
                {[["Listening", "50", "about 35 min"], ["Structure & WE", "40", "25 min"], ["Reading", "50", "55 min"]].map(([s, q, t]) => (
                  <div key={s} className="grid grid-cols-3 border-t border-[#2A5591] px-5 py-3.5 text-[15px]"><span className="font-semibold">{s}</span><span className="text-mist">{q}</span><span>{t}</span></div>
                ))}
              </div>
              <p className="text-sm text-[#B9CBE6]">Full TOEFL ITP format simulation, 140 questions.</p>
            </div>
            <div className="flex w-full max-w-[480px] flex-col gap-5 self-center rounded-[20px] bg-white p-8 text-ink">
              <span className="font-display text-[22px] font-extrabold text-navy">What your institution gets</span>
              <ul className="flex flex-col gap-3.5 text-base">
                {["Bulk participant invites by email or Excel import", "A dashboard of group results and progress", "PDF and Excel reports per participant and per group", "Coaches and coaching session quotas", "Group schedules for the official ITP"].map((t) => <li key={t} className="flex gap-3"><Check color="#1B5FB8" /><span>{t}</span></li>)}
              </ul>
              <a href={contact} className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">Contact us</a>
            </div>
          </div>
        </section>

        {/* Untuk siapa */}
        <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="flex flex-col gap-4">
            <Eyebrow>WHO IT IS FOR</Eyebrow>
            <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Designed for every learner.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map(([t, d]) => (
              <div key={t} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-6"><span className="text-lg font-semibold text-navy">{t}</span><span className="text-[15px] leading-relaxed text-ink-soft">{d}</span></div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[360px_1fr] lg:gap-16 lg:px-10 lg:py-28">
            <div className="flex flex-col gap-4">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Frequently asked questions</h2>
              {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="font-semibold text-brand">Ask us on WhatsApp</a>}
            </div>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a], i) => (
                <details key={q} className="group py-1" open={i === 0}>
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-[17px] font-semibold text-navy [&::-webkit-details-marker]:hidden">
                    {q}<span className="text-2xl font-normal text-brand group-open:hidden" aria-hidden>+</span><span className="hidden text-2xl font-normal text-brand group-open:inline" aria-hidden>-</span>
                  </summary>
                  <p className="pb-5 pr-8 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA akhir */}
        <section className="bg-brand">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-16 text-white sm:px-6 lg:flex-row lg:items-center lg:px-10">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-[38px]">Learning English should not be guesswork.</h2>
              <p className="text-lg text-[#DCE7F7]">Start by knowing your score today.</p>
            </div>
            <Link href="/masuk" className="inline-flex h-14 shrink-0 items-center rounded-xl bg-white px-8 text-[17px] font-semibold text-brand hover:bg-brand-tint">Sign in</Link>
          </div>
        </section>
      </main>

      <PublicFooter email={email} whatsapp={whatsapp} />
    </div>
  );
}
