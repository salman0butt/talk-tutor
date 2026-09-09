import { NextResponse } from "next/server";
import {
  getAdminBillingAccountByCustomerId,
  isStripeWebhookProcessed,
  markStripeWebhookProcessed,
  syncStripeSubscription,
} from "@/lib/billing/admin-repository";
import {
  isRelevantStripeEventType,
  mapStripeSubscriptionSnapshot,
  verifyStripeWebhookSignature,
} from "@/lib/billing/stripe-events";
import {
  getStripePriceConfig,
  getStripeWebhookSecret,
  retrieveStripeSubscription,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function synchronizeSubscription(value: unknown) {
  const snapshot = mapStripeSubscriptionSnapshot(
    value,
    getStripePriceConfig(),
  );
  if (!snapshot) {
    throw new Error("Stripe subscription does not map to a configured plan.");
  }

  const existing = await getAdminBillingAccountByCustomerId(
    snapshot.stripeCustomerId,
  );
  if (!existing) {
    throw new Error("Stripe customer is not linked to a Talk Tutor account.");
  }

  if (
    snapshot.metadataUserId &&
    snapshot.metadataUserId !== existing.userId
  ) {
    throw new Error("Stripe subscription metadata owner mismatch.");
  }

  await syncStripeSubscription(existing.userId, snapshot);
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret();
  } catch {
    return NextResponse.json(
      { error: "Webhook verification is not configured." },
      { status: 503 },
    );
  }

  if (
    !verifyStripeWebhookSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      webhookSecret,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  let event: StripeEvent;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    const record = objectRecord(parsed);
    if (
      !record ||
      typeof record.id !== "string" ||
      typeof record.type !== "string" ||
      !record.data ||
      typeof record.data !== "object"
    ) {
      throw new Error("Malformed event.");
    }
    event = parsed as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid Stripe event." }, { status: 400 });
  }

  if (!isRelevantStripeEventType(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (await isStripeWebhookProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = objectRecord(event.data.object);
      const subscription =
        typeof session?.subscription === "string"
          ? session.subscription
          : objectRecord(session?.subscription)?.id;

      if (typeof subscription !== "string") {
        throw new Error(
          "Completed subscription Checkout session has no subscription id.",
        );
      }

      await synchronizeSubscription(
        await retrieveStripeSubscription(subscription),
      );
    } else {
      await synchronizeSubscription(event.data.object);
    }

    await markStripeWebhookProcessed(event.id, event.type);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      "[Stripe webhook] synchronization failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Webhook could not be synchronized." },
      { status: 500 },
    );
  }
}
