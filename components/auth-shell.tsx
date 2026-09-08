import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Languages, Mic2, Sparkles } from "lucide-react";

const benefits = [
  "Real-time speaking practice",
  "Adaptive conversations for your level",
  "Instant transcript and feedback",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#08090d] text-white">
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div className="absolute inset-0 auth-grid opacity-40" />
          <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

          <Link href="/" className="relative z-10 flex w-fit items-center gap-3">
            <Image
              src="/logo-tutor.png"
              alt="Talk Tutor"
              width={46}
              height={46}
              className="rounded-xl"
              priority
            />
            <span className="text-xl font-semibold tracking-tight">
              Talk <span className="text-amber-400">Tutor</span>
            </span>
          </Link>

          <div className="relative z-10 max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-sm text-amber-200">
              <Sparkles className="h-4 w-4" />
              Your always-on AI language partner
            </div>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.045em] xl:text-6xl">
              Stop studying a language.
              <span className="block text-white/55">Start speaking it.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/60">
              Build confidence through natural, low-pressure conversations that
              adapt to your language and proficiency.
            </p>

            <div className="mt-9 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 text-white/75">
                  <CheckCircle2 className="h-5 w-5 text-amber-400" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {[
              [Languages, "Choose", "your language"],
              [Mic2, "Speak", "naturally"],
              [Sparkles, "Improve", "every session"],
            ].map(([Icon, title, label]) => {
              const Component = Icon as typeof Languages;
              return (
                <div
                  key={String(title)}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur"
                >
                  <Component className="mb-5 h-5 w-5 text-amber-400" />
                  <p className="text-sm font-medium">{String(title)}</p>
                  <p className="mt-1 text-xs text-white/40">{String(label)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
          <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-amber-400/[0.08] to-transparent lg:hidden" />
          <div className="relative w-full max-w-md">
            <Link
              href="/"
              className="mb-10 flex items-center justify-center gap-3 lg:hidden"
            >
              <Image
                src="/logo-tutor.png"
                alt="Talk Tutor"
                width={42}
                height={42}
                className="rounded-xl"
                priority
              />
              <span className="text-lg font-semibold tracking-tight">
                Talk <span className="text-amber-400">Tutor</span>
              </span>
            </Link>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
