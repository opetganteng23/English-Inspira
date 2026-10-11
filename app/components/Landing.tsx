import Link from "next/link";
import { Logo } from "./Logo";
import { PublicFooter } from "./PublicShell";
import { Reveal, HeaderShell } from "./LandingFx";
import { DesktopNav, MobileMenu } from "./LandingNav";
import { HeroExample } from "./HeroExample";
import { TextMarquee, LogoMarquee } from "./Marquee";
import { LANDING_DEFAULTS, type LandingSettings } from "@/lib/landing-settings";

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
  ["How do I get access?", "Access is provided through partner institutions. Create an account with the institution code you received, or use the invitation email from your institution. You can sign in with your password or with a one-time code sent to your email."],
  ["What can I ask the AI Counselor?", "Anything about your results: why a section score is low, what to do this week, how long until you reach your target, or whether you are ready for the official test."],
  ["What device do I need?", "A laptop or PC with headphones and a stable connection. The test room runs in fullscreen, and leaving the test tab is recorded."],
  ["Is my data safe?", "Your data is used only for your learning and your institution's reports. The AI receives scores and answers without your name or contact details. You can download your data or request deletion from your profile."],
  ["I forgot my password. What should I do?", "Use Forgot password on the sign-in page and we will email you a link to set a new one. You can also sign in with a one-time email code: use the code from the newest email, shown in the email subject and valid for 5 minutes."],
  ["My institution wants to join. How?", "Contact us using the details at the bottom of this page. We will set up your institution, participant seats, and test schedules."],
];

export function Landing({ email, whatsapp, settings = LANDING_DEFAULTS }: { email?: string; whatsapp?: string; settings?: LandingSettings }) {
  const hero = settings;
  const dark = hero.theme === "dark";
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent("English Inspira for our institution")}` : whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "https://inspiratekno.com";
  return (
    <div className="bg-canvas text-ink">
      <noscript><style>{".reveal,.fx-fade-up,.fx-pop,.chat-in{opacity:1!important;transform:none!important;animation:none!important}"}</style></noscript>
      <HeaderShell className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur transition-shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Logo dark />
          <DesktopNav />
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="hidden min-h-[44px] items-center px-3 text-[15px] font-semibold text-navy hover:text-brand sm:inline-flex">Sign in</Link>
            <Link href="/register" className="btn-solid btn-lift !min-h-[44px] !px-5">Create account</Link>
            <MobileMenu />
          </div>
        </div>
      </HeaderShell>

      <main>
        {/* Hero (judul, deskripsi, latar, dan contoh hasil dapat diatur admin di Settings) */}
        <section className={`relative overflow-hidden ${dark ? "bg-navy text-white" : "bg-white"}`}>
          {hero.bgImageId ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/assets/${hero.bgImageId}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ background: dark ? `rgba(10,34,87,${hero.overlay / 100})` : `rgba(255,255,255,${hero.overlay / 100})` }} aria-hidden />
            </>
          ) : (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="fx-drift absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-brand/10 blur-3xl" />
              <div className="fx-drift absolute -bottom-32 right-1/3 h-[360px] w-[360px] rounded-full bg-accent/20 blur-3xl" style={{ animationDelay: "-6s" }} />
              <div className="fx-drift absolute right-[-80px] top-10 h-[300px] w-[300px] rounded-full bg-brand/10 blur-3xl" style={{ animationDelay: "-10s" }} />
            </div>
          )}
          <div className={`relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-10 sm:px-6 md:py-14 lg:gap-14 lg:px-10 lg:py-16 ${hero.showExample ? "lg:flex-row" : "lg:py-24"}`}>
            <div className="flex flex-1 flex-col gap-7">
              {hero.badge && (
                <span className={`fx-fade-up inline-flex items-center gap-2 self-start rounded-full px-3.5 py-2 text-[13px] font-semibold ${dark ? "bg-white/15 text-white" : "bg-brand-tint text-brand-dark"}`}>
                  <span className="fx-ring h-2 w-2 rounded-full bg-accent" />{hero.badge}
                </span>
              )}
              <h1 className={`fx-fade-up font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[58px] ${dark ? "text-white" : "text-navy"}`} style={{ "--d": "120ms" } as React.CSSProperties}>{hero.title}</h1>
              {hero.subtitle && <p className={`fx-fade-up max-w-xl text-lg leading-relaxed sm:text-[19px] ${dark ? "text-[#DCE7F7]" : "text-[#3B4A60]"}`} style={{ "--d": "240ms" } as React.CSSProperties}>{hero.subtitle}</p>}
              <div className="fx-fade-up flex flex-col gap-3 sm:flex-row sm:items-center" style={{ "--d": "360ms" } as React.CSSProperties}>
                <Link href="/register" className="btn-lift inline-flex h-14 items-center justify-center rounded-xl bg-brand px-7 text-[17px] font-semibold text-white hover:bg-brand-dark">Create account</Link>
                <Link href="/sign-in" className={`btn-lift inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] px-7 text-[17px] font-semibold hover:border-brand ${dark ? "border-white/50 bg-white/10 text-white" : "border-line-strong bg-white text-navy"}`}>Sign in</Link>
                <a href="#institutions" className={`btn-lift inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] px-7 text-[17px] font-semibold hover:border-brand ${dark ? "border-white/50 bg-white/10 text-white" : "border-line-strong bg-white text-navy"}`}>For institutions</a>
              </div>
              <div className={`fx-fade-up flex flex-wrap gap-x-5 gap-y-1 text-sm ${dark ? "text-[#DCE7F7]" : "text-ink-soft"}`} style={{ "--d": "480ms" } as React.CSSProperties}>
                <span>Register with your institution code</span><span className="opacity-40" aria-hidden>|</span><span>Password or email code</span><span className="opacity-40" aria-hidden>|</span><span>Official ITP registration</span>
              </div>
            </div>
            {hero.showExample && <HeroExample />}
          </div>
        </section>

        {/* Mitra: logo berjalan (nama dan logo diatur admin di Settings) */}
        <LogoMarquee partners={hero.partners} label="DEVELOPED AND OWNED BY" />

        {/* Cara kerja */}
        <section id="how" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-12 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-10">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>HOW IT WORKS</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Test, understand, act, measure again.</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-[#3B4A60]">Every test result comes with an explanation and concrete steps, then gets measured again so you know whether the approach is working.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100} className="h-full"><div className="hover-lift group flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-7">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white transition-transform duration-300 group-hover:scale-110 ${s.bg}`}>{s.n}</span>
                <span className="text-xl font-semibold text-navy">{s.t}</span>
                <span className="text-[15px] leading-relaxed text-ink-soft">{s.d}</span>
              </div></Reveal>
            ))}
          </div>
        </section>

        {/* AI Counselor */}
        <section id="counselor" className="scroll-mt-20 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:gap-[64px] lg:px-10 lg:py-16">
            <div className="flex flex-1 flex-col gap-6">
              <Eyebrow className="text-success">AI COUNSELOR</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">More than a score. Someone to explain it and guide you.</h2>
              <p className="text-[17px] leading-relaxed text-[#3B4A60]">Developed with CoE AILO Telkom University. The AI Counselor reads all your test results, including your answer to each question and the time you spent.</p>
              <ul className="flex flex-col gap-3.5 text-base">
                {["Explains why each section score is what it is", "Builds a plan that fits the time you have", "An action plan you can tick off, with email reminders", "Tells you when you are ready to register for the official test"].map((t) => <li key={t} className="flex gap-3"><Check /><span>{t}</span></li>)}
              </ul>
            </div>
            <Reveal className="w-full max-w-[560px] shrink-0"><div className="flex w-full flex-col gap-3.5 rounded-[20px] border border-line bg-canvas p-6" aria-label="Example conversation">
              <div style={{ "--cd": "450ms" } as React.CSSProperties} className="chat-in flex gap-2.5"><span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-success-tint text-[11px] font-semibold text-success">AI</span><div className="rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed">Your Reading score is 49. The issue is time: the last 4 questions were unanswered because you ran out of time on the third passage.</div></div>
              <div style={{ "--cd": "900ms" } as React.CSSProperties} className="chat-in max-w-[380px] self-end rounded-[14px_4px_14px_14px] bg-brand px-3.5 py-3 text-sm leading-normal text-white">I only have 30 minutes a day.</div>
              <div style={{ "--cd": "1350ms" } as React.CSSProperties} className="chat-in flex gap-2.5"><span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-success-tint text-[11px] font-semibold text-success">AI</span><div className="rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed">That works. 15 minutes of Structure, then 15 minutes on one Reading passage with a timer. Listening twice a week is enough. We will move your next test back by 1 week.</div></div>
              <div style={{ "--cd": "1800ms" } as React.CSSProperties} className="chat-in flex items-center gap-2 rounded-xl border border-dashed border-[#A9D8BC] bg-white px-3.5 py-3 text-[13px] text-[#164F2F]"><Check color="#1D6B3F" /><span>Study plan updated · reminder every Monday</span></div>
            </div></Reveal>
          </div>
        </section>

        <TextMarquee items={hero.marquee} tone="navy" />

        {/* Journey */}
        <section id="journey" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-12 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-10">
            <div className="flex max-w-3xl flex-col gap-4">
              <Eyebrow>ENGLISH INTELLIGENCE JOURNEY</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Seven stages. One complete journey.</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-[#3B4A60]">Your institution’s program decides which stages are open to you. Everything is in one account.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PHASES.map((p, i) => (
              <Reveal key={p.no} delay={(i % 4) * 90} className="h-full"><div className="hover-lift flex h-full min-h-[196px] flex-col gap-2.5 rounded-2xl border border-line bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold tracking-wider text-ink-soft">PHASE {p.no}</span>
                  <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-dark">{p.tool}</span>
                </div>
                <span className="font-display text-2xl font-extrabold text-navy">{p.name}</span>
                <span className="text-[15px] font-semibold text-accent-dark">{p.tag}</span>
                <span className="text-sm leading-relaxed text-ink-soft">{p.desc}</span>
              </div></Reveal>
            ))}
            <div className="hover-lift flex min-h-[196px] flex-col justify-between gap-4 rounded-2xl bg-navy p-6">
              <span className="font-display text-[22px] font-extrabold leading-snug text-white">Have a code from your institution?</span>
              <Link href="/register" className="btn-lift inline-flex h-11 items-center self-start rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-navy hover:bg-[#E8B04A]">Create account</Link>
            </div>
          </div>
        </section>

        {/* Institusi */}
        <section id="institutions" className="scroll-mt-20 bg-navy text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-12 sm:px-6 lg:flex-row lg:gap-16 lg:px-10 lg:py-16">
            <div className="flex flex-1 flex-col gap-6">
              <Eyebrow className="text-[#F3D68A]">FOR INSTITUTIONS</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-[42px]">Campuses, agencies &amp; companies.</h2>
              <p className="max-w-xl text-[17px] leading-relaxed text-mist">English Inspira is provided through partner institutions. You run the program for your participants; we provide the tests, the analysis, and the learning path.</p>
              <div className="max-w-xl overflow-hidden rounded-[14px] border border-[#2A5591]">
                <div className="grid grid-cols-3 bg-navy-700 px-5 py-3.5 text-[13px] font-semibold text-[#B9CBE6]"><span>Section</span><span>Questions</span><span>Time</span></div>
                {[["Listening", "50", "about 35 min"], ["Structure & WE", "40", "25 min"], ["Reading", "50", "55 min"]].map(([s, q, t]) => (
                  <div key={s} className="grid grid-cols-3 border-t border-[#2A5591] px-5 py-3.5 text-[15px] transition-colors hover:bg-navy-700"><span className="font-semibold">{s}</span><span className="text-mist">{q}</span><span>{t}</span></div>
                ))}
              </div>
              <p className="text-sm text-[#B9CBE6]">Full TOEFL ITP format simulation, 140 questions.</p>
            </div>
            <Reveal className="w-full max-w-[480px] self-center" delay={150}><div className="hover-lift flex w-full flex-col gap-5 rounded-[20px] bg-white p-8 text-ink">
              <span className="font-display text-[22px] font-extrabold text-navy">What your institution gets</span>
              <ul className="flex flex-col gap-3.5 text-base">
                {["Bulk participant invites by email or Excel import", "A dashboard of group results and progress", "PDF and Excel reports per participant and per group", "Coaches and coaching session quotas", "Group schedules for the official ITP"].map((t) => <li key={t} className="flex gap-3"><Check color="#0B4FA6" /><span>{t}</span></li>)}
              </ul>
              <a href={contact} className="btn-lift inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">Contact us</a>
            </div></Reveal>
          </div>
        </section>

        {/* Untuk siapa */}
        <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="flex flex-col gap-4">
            <Eyebrow>WHO IT IS FOR</Eyebrow>
            <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Designed for every learner.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 90} className="h-full"><div className="hover-lift flex h-full flex-col gap-2 rounded-2xl border border-line bg-white p-6"><span className="text-lg font-semibold text-navy">{t}</span><span className="text-[15px] leading-relaxed text-ink-soft">{d}</span></div></Reveal>
            ))}
          </div>
        </section>

        <TextMarquee items={[...hero.marquee].reverse()} tone="gold" reverse />

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[360px_1fr] lg:gap-16 lg:px-10 lg:py-16">
            <div className="flex flex-col gap-4">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-navy sm:text-[42px]">Frequently asked questions</h2>
              {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="font-semibold text-brand">Ask us on WhatsApp</a>}
            </div>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a], i) => (
                <details key={q} className="group py-1" open={i === 0}>
                  <summary className="flex min-h-[56px] cursor-pointer transition-colors hover:text-brand list-none items-center justify-between gap-4 py-3 text-left text-[17px] font-semibold text-navy [&::-webkit-details-marker]:hidden">
                    {q}<span className="text-2xl font-normal text-brand group-open:hidden" aria-hidden>+</span><span className="hidden text-2xl font-normal text-brand group-open:inline" aria-hidden>-</span>
                  </summary>
                  <p className="faq-body pb-5 pr-8 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA akhir */}
        <section className="bg-brand">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-10 text-white sm:px-6 lg:flex-row lg:items-center lg:px-10">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-[38px]">Learning English should not be guesswork.</h2>
              <p className="text-lg text-[#DCE7F7]">Start by knowing your score today.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-lift inline-flex h-14 items-center justify-center rounded-xl bg-white px-8 text-[17px] font-semibold text-brand hover:bg-brand-tint">Create account</Link>
              <Link href="/sign-in" className="btn-lift inline-flex h-14 items-center justify-center rounded-xl border-[1.5px] border-white/60 px-8 text-[17px] font-semibold text-white hover:bg-white/10">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter email={email} whatsapp={whatsapp} />
    </div>
  );
}
