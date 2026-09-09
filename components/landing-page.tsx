import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleCheck,
  Globe2,
  Headphones,
  Languages,
  MessageCircleMore,
  Mic2,
  Plane,
  ShieldCheck,
  Sparkles,
  Utensils,
  Volume2,
  Zap,
} from "lucide-react";

const languages = [
  ["English", "Hello"],
  ["Spanish", "Hola"],
  ["French", "Bonjour"],
  ["German", "Hallo"],
  ["Japanese", "こんにちは"],
  ["Korean", "안녕하세요"],
  ["Chinese", "你好"],
  ["Hindi", "नमस्ते"],
  ["Portuguese", "Olá"],
];

const features = [
  {
    icon: Mic2,
    title: "Speak, don’t tap",
    text: "Practice the skill that matters most: having a natural conversation out loud.",
  },
  {
    icon: BrainCircuit,
    title: "Adapts to your level",
    text: "Choose your proficiency and get a conversation that meets you where you are.",
  },
  {
    icon: MessageCircleMore,
    title: "Follow every word",
    text: "See the live conversation transcript while you build listening and speaking confidence.",
  },
  {
    icon: Volume2,
    title: "Pick your tutor’s voice",
    text: "Choose from distinct AI voice personalities to make practice feel comfortable and fresh.",
  },
  {
    icon: Globe2,
    title: "Practice useful languages",
    text: "Switch across major languages and regional variants whenever your learning goals change.",
  },
  {
    icon: Zap,
    title: "Start in seconds",
    text: "Choose a language, topic and level, then jump straight into a real-time voice session.",
  },
];

const scenarios = [
  { icon: MessageCircleMore, name: "Free Chat", copy: "Build everyday fluency" },
  { icon: BriefcaseBusiness, name: "Job Interview", copy: "Prepare for high-stakes moments" },
  { icon: Plane, name: "Travel & Directions", copy: "Feel ready before the trip" },
  { icon: Utensils, name: "Ordering Food", copy: "Practice practical conversations" },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/logo-tutor.png"
        alt="Talk Tutor"
        width={40}
        height={40}
        className="rounded-xl"
        priority
      />
      <span className="text-[17px] font-semibold tracking-[-0.025em] text-white">
        Talk <span className="text-amber-400">Tutor</span>
      </span>
    </Link>
  );
}

export function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  const primaryHref = isAuthenticated ? "/dashboard" : "/signup";
  const primaryLabel = isAuthenticated ? "Open dashboard" : "Start speaking free";

  return (
    <main className="min-h-screen overflow-hidden bg-[#08090d] text-white selection:bg-amber-300 selection:text-black">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.16),transparent_45%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-280px] h-[640px] w-[640px] -translate-x-1/2 rounded-full border border-amber-300/10" />
        <div className="pointer-events-none absolute left-1/2 top-[-170px] h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-white/[0.05]" />

        <header className="relative z-40 border-b border-white/[0.07] bg-[#08090d]/75 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
            <Brand />

            <nav className="hidden items-center gap-8 text-sm text-white/55 md:flex">
              <a href="#how-it-works" className="transition hover:text-white">
                How it works
              </a>
              <a href="#features" className="transition hover:text-white">
                Features
              </a>
              <a href="#languages" className="transition hover:text-white">
                Languages
              </a>
            </nav>

            <div className="flex items-center gap-2">
              {!isAuthenticated && (
                <Link
                  href="/login"
                  className="hidden h-10 items-center rounded-xl px-4 text-sm font-medium text-white/65 transition hover:bg-white/[0.05] hover:text-white sm:flex"
                >
                  Sign in
                </Link>
              )}
              <Link
                href={primaryHref}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-amber-300"
              >
                {isAuthenticated ? "Open tutor" : "Get started"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:px-10 lg:pb-28 lg:pt-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-medium text-amber-200 sm:text-sm">
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              Real-time AI conversation practice
            </div>

            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl md:text-7xl lg:text-[86px]">
              Learn a language
              <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                by actually speaking it.
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
              Talk Tutor gives you a patient, always-available conversation
              partner that adapts to your language, level, and real-world goals.
              No flashcards. No fear. Just speak.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 text-sm font-semibold text-black shadow-[0_18px_70px_-24px_rgba(251,191,36,0.9)] transition hover:-translate-y-0.5 hover:bg-amber-300 sm:w-auto"
              >
                <Mic2 className="h-4 w-4" />
                {primaryLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-6 text-sm font-medium text-white/75 backdrop-blur transition hover:bg-white/[0.07] hover:text-white sm:w-auto"
              >
                See how it works
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/30">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Secure account
              </span>
            </div>
          </div>

          <div className="relative mx-auto mt-16 max-w-6xl lg:mt-20">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-amber-300/[0.04] blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111218] shadow-2xl shadow-black/50">
              <div className="flex h-12 items-center border-b border-white/[0.07] px-4">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/25">
                  Talk Tutor · Live practice
                </div>
              </div>

              <div className="grid min-h-[500px] lg:grid-cols-[230px_1fr_250px]">
                <aside className="hidden border-r border-white/[0.07] bg-white/[0.015] p-5 lg:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                    Practice setup
                  </p>
                  <div className="mt-6 space-y-5">
                    {[
                      ["Language", "Spanish · Spain"],
                      ["Your level", "Intermediate"],
                      ["Topic", "Travel & Directions"],
                      ["Tutor voice", "Aoede · Confident"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="mb-2 text-[11px] text-white/35">{label}</p>
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-xs text-white/70">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden p-8">
                  <div className="absolute inset-0 landing-dot-grid opacity-30" />
                  <div className="relative">
                    <div className="absolute inset-[-42px] rounded-full bg-amber-400/10 blur-2xl" />
                    <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-amber-300/20 bg-gradient-to-br from-amber-300/20 via-orange-500/10 to-violet-500/10 shadow-[inset_0_0_40px_rgba(251,191,36,0.08)] sm:h-44 sm:w-44">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-300 text-black shadow-[0_0_60px_rgba(251,191,36,0.38)]">
                        <AudioLines className="h-8 w-8" />
                      </div>
                    </div>
                  </div>

                  <p className="relative mt-8 text-sm font-medium">Your tutor is listening</p>
                  <p className="relative mt-1 text-xs text-white/35">
                    Speak naturally — interrupt anytime
                  </p>

                  <div className="relative mt-8 flex h-14 items-end justify-center gap-1.5">
                    {[22, 38, 30, 52, 68, 44, 78, 58, 34, 62, 46, 28, 54, 36, 20].map(
                      (height, index) => (
                        <span
                          key={index}
                          className="landing-wave-bar w-1.5 rounded-full bg-amber-300/80"
                          style={{
                            height: `${height}%`,
                            animationDelay: `${index * 70}ms`,
                          }}
                        />
                      ),
                    )}
                  </div>

                  <div className="relative mt-10 flex items-center gap-3">
                    <div className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs text-white/55">
                      00:48
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-black">
                      <Mic2 className="h-4 w-4" />
                    </div>
                    <div className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-2 text-xs text-emerald-300">
                      Live
                    </div>
                  </div>
                </div>

                <aside className="hidden border-l border-white/[0.07] bg-white/[0.015] p-5 lg:block">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                      Transcript
                    </p>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-7 space-y-5">
                    <div>
                      <p className="text-[10px] font-medium text-amber-300">AI TUTOR</p>
                      <p className="mt-2 text-xs leading-5 text-white/55">
                        ¡Perfecto! Imagine you&apos;ve just arrived in Madrid. How
                        would you ask someone where the nearest metro station is?
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                      <p className="text-[10px] font-medium text-sky-300">YOU</p>
                      <p className="mt-2 text-xs leading-5 text-white/65">
                        Disculpe, ¿dónde está la estación de metro más cercana?
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-amber-300">AI TUTOR</p>
                      <p className="mt-2 text-xs leading-5 text-white/55">
                        Excellent — that sounds natural and polite. Let&apos;s keep going.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[
                ["11", "language variants"],
                ["7", "practice scenarios"],
                ["5", "tutor voices"],
                ["3", "proficiency levels"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4 text-center"
                >
                  <p className="text-xl font-semibold text-amber-300">{value}</p>
                  <p className="mt-1 text-[11px] text-white/30">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section id="languages" className="border-y border-white/[0.07] bg-white/[0.018] py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/25">
            Practice across the languages you care about
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {languages.map(([name, greeting]) => (
              <div
                key={name}
                className="group flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 transition hover:border-amber-300/20 hover:bg-amber-300/[0.05]"
              >
                <span className="text-sm font-medium text-white/70">{name}</span>
                <span className="text-xs text-white/25 transition group-hover:text-amber-200/60">
                  {greeting}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-400">
              <Sparkles className="h-4 w-4" />
              How it works
            </div>
            <h2 className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
              From “I know the words” to “I can say it.”
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/45">
              Talk Tutor removes the awkward part of language practice. You get a
              private place to try, stumble, repeat, and improve at your pace.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                n: "01",
                icon: Languages,
                title: "Choose what you want to practice",
                copy: "Pick a language, your current proficiency, a useful scenario, and the tutor voice you prefer.",
              },
              {
                n: "02",
                icon: Headphones,
                title: "Have a real conversation",
                copy: "Speak naturally with a live AI tutor. The session responds in real time so practice feels like dialogue, not a quiz.",
              },
              {
                n: "03",
                icon: CircleCheck,
                title: "Build confidence by doing",
                copy: "Follow the transcript, try new phrases, change topics, and keep practicing until the words come more naturally.",
              },
            ].map(({ n, icon: Icon, title, copy }) => (
              <div
                key={n}
                className="group grid gap-5 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-transparent p-6 transition hover:border-amber-300/15 sm:grid-cols-[70px_1fr] sm:p-8"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] text-amber-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-white/20">
                    STEP {n}
                  </span>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/42">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-white/[0.07] bg-[#0b0c11] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-amber-400">Built for speaking practice</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Everything gets out of the way of the conversation.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/42">
              A focused practice space that helps you spend less time configuring
              and more time using the language.
            </p>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-amber-300/15 hover:bg-white/[0.04] sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-amber-300 transition group-hover:border-amber-300/20 group-hover:bg-amber-300/[0.07]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/40">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium text-amber-400">Practice for real life</p>
            <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Rehearse the conversation before it matters.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/42">
              From casual small talk to interviews and travel, switch the context
              whenever you want to train for a different moment.
            </p>
            <Link
              href={primaryHref}
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 transition hover:text-amber-200"
            >
              Choose your practice scenario
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {scenarios.map(({ icon: Icon, name, copy }, index) => (
              <div
                key={name}
                className={
                  "rounded-3xl border border-white/[0.08] p-6 " +
                  (index === 1 || index === 2
                    ? "bg-amber-300/[0.055]"
                    : "bg-white/[0.025]")
                }
              >
                <Icon className="h-5 w-5 text-amber-300" />
                <h3 className="mt-7 font-semibold">{name}</h3>
                <p className="mt-2 text-sm text-white/35">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8 lg:px-10 lg:pb-32">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-amber-200/15 bg-gradient-to-br from-amber-300/[0.13] via-white/[0.035] to-violet-500/[0.07] px-6 py-16 text-center sm:px-10 lg:py-20">
          <div className="pointer-events-none absolute inset-0 landing-dot-grid opacity-20" />
          <div className="relative">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-black shadow-[0_12px_50px_-16px_rgba(251,191,36,0.85)]">
              <Mic2 className="h-5 w-5" />
            </div>
            <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Your next language breakthrough might just be a conversation away.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/45">
              Create your account, choose what you want to practice, and start speaking.
            </p>
            <Link
              href={primaryHref}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Brand />
          <p className="text-xs text-white/25">
            Speak more. Hesitate less. Keep going.
          </p>
          <div className="flex gap-5 text-xs text-white/35">
            {isAuthenticated ? (
              <Link href="/dashboard" className="transition hover:text-white">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="transition hover:text-white">
                  Sign in
                </Link>
                <Link href="/signup" className="transition hover:text-white">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
