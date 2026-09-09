import { NextResponse } from "next/server";
import {
  getAdminBillingAccountByUserId,
  recordStripeCustomer,
} from "@/lib/billing/admin-repository";
import { isPaidPlanId } from "@/lib/billing/plans";
import { requireBillingIdentity } from "@/lib/billing/server";
import {
  assertStripePriceMatchesPlan,
  createStripeCheckoutSession,
  createStripeCustomer,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const planId =
    body && typeof body === "object" && "planId" in body
      ? (body as { planId?: unknown }).planId
      : null;

  if (!isPaidPlanId(planId)) {
    return NextResponse.json(
      { error: "Choose Starter or Pro." },
      { status: 400 },
    );
  }

  try {
    const { user, userId, repository } = await requireBillingIdentity();
    const entitlement = await repository.getEntitlement();

    if (entitlement.isPaid) {
      return NextResponse.json(
        {
          error:
            "You already have a paid subscription. Manage it from Billing.",
          code: "subscription_exists",
        },
        { status: 409 },
      );
    }

    const priceId = await assertStripePriceMatchesPlan(planId);
    let account = await getAdminBillingAccountByUserId(userId);

    if (!account) {
      const customer = await createStripeCustomer({
        userId,
        email: user.email,
      });
      if (!customer.id) throw new Error("Stripe did not return a customer id.");
      account = await recordStripeCustomer(userId, customer.id);
    }

    const checkout = await createStripeCheckoutSession({
      userId,
      customerId: account.stripeCustomerId,
      planId,
      priceId,
    });

    if (!checkout.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "BillingAuthenticationError"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Checkout could not be created.",
      },
      { status: 503 },
    );
  }
}
