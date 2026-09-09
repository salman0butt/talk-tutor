import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { UsageMeter } from "@/components/billing/usage-meter";
import { getCurrentBillingViewModel } from "@/lib/billing/server";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [view, query] = await Promise.all([
    getCurrentBillingViewModel(),
    searchParams,
  ]);
  const { account, entitlement, hasBillingCustomer } = view;

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-amber-400">Billing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Plan and conversation allowance
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Your live tutor entitlement and the token endpoint use this same
            server-resolved billing state.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/70 transition hover:bg-white/[0.05] hover:text-white"
        >
          Compare plans
        </Link>
      </div>

      {query.checkout === "success" && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
          Checkout completed. Stripe is synchronizing your subscription; this
          page reflects the latest verified webhook state.
        </p>
      )}

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <UsageMeter entitlement={entitlement} />

        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
            Current plan
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{entitlement.planName}</h2>
          <p className="mt-2 text-sm text-white/40">
            Status: {entitlement.status.replaceAll("_", " ")}
          </p>

          {entitlement.cancelAtPeriodEnd && (
            <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-100">
              Your paid plan is set to cancel at the end of the current period.
              Paid entitlement remains active until then.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {entitlement.isPaid && hasBillingCustomer ? (
              <ManageBillingButton />
            ) : (
              <>
                <CheckoutButton planId="starter">
                  Upgrade to Starter · $9/month
                </CheckoutButton>
                <CheckoutButton
                  planId="pro"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.07] disabled:opacity-60"
                >
                  Upgrade to Pro · $19/month
                </CheckoutButton>
              </>
            )}
          </div>

          {account?.stripeCustomerId && (
            <div className="mt-6 flex items-start gap-2 border-t border-white/[0.06] pt-5 text-xs leading-5 text-white/30">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Payment-method and invoice management stays on Stripe-hosted
              pages. Talk Tutor stores only subscription identifiers and status,
              not card data.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
