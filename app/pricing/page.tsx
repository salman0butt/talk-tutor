import Link from "next/link";
import { Check } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { listPlanDefinitions, type PaidPlanId } from "@/lib/billing/plans";

const features: Record<string, string[]> = {
  free: [
    "30 minutes of live conversation each month",
    "Session history and transcripts",
    "Post-session learning feedback",
    "Vocabulary review",
  ],
  starter: [
    "150 minutes of live conversation each month",
    "Everything in Free",
    "Personalized practice and progress tracking",
    "Stripe self-service billing",
  ],
  pro: [
    "400 minutes of live conversation each month",
    "Everything in Starter",
    "More room for daily speaking practice",
    "Same learning history across plan changes",
  ],
};

export default function PricingPage() {
  const plans = listPlanDefinitions();

  return (
    <main className="min-h-dvh bg-[#08090d] px-4 py-12 text-white sm:px-6 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-amber-400">
            Talk Tutor
          </Link>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Simple plans for real speaking practice.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
            Start free. Upgrade when you need more live conversation time.
            Usage is enforced in exact seconds and resets with your billing
            period.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <section
              key={plan.id}
              className={
                plan.id === "starter"
                  ? "rounded-3xl border border-amber-300/30 bg-amber-300/[0.06] p-6 ring-1 ring-amber-300/10 sm:p-7"
                  : "rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7"
              }
            >
              <p className="text-sm font-semibold text-white/70">{plan.name}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-semibold">
                  ${(plan.monthlyPriceCents / 100).toFixed(0)}
                </span>
                <span className="pb-1 text-sm text-white/35">/ month</span>
              </div>
              <p className="mt-2 text-sm text-white/40">
                {plan.monthlyMinutes} live conversation minutes
              </p>

              <ul className="mt-6 space-y-3">
                {features[plan.id].map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-2 text-sm leading-5 text-white/55"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {plan.id === "free" ? (
                  <Link
                    href="/signup"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold transition hover:bg-white/[0.07]"
                  >
                    Start free
                  </Link>
                ) : (
                  <CheckoutButton planId={plan.id as PaidPlanId}>
                    Choose {plan.name}
                  </CheckoutButton>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-white/30">
          Paid subscriptions renew monthly until canceled. Canceling at period
          end keeps paid access through the end of the already-paid period.
          Payment details are handled on Stripe-hosted pages.
        </p>
      </div>
    </main>
  );
}
