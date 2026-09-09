import "server-only";

import {
  getPlanDefinition,
  isPaidPlanId,
  type PaidPlanId,
} from "@/lib/billing/plans";
import type { StripePriceConfig } from "@/lib/billing/stripe-events";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

function stripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }
  return key;
}

export function getStripePriceConfig(): StripePriceConfig {
  const starter = process.env.STRIPE_PRICE_STARTER;
  const pro = process.env.STRIPE_PRICE_PRO;
  if (!starter || !pro) {
    throw new Error(
      "Stripe prices are not configured. Set STRIPE_PRICE_STARTER and STRIPE_PRICE_PRO.",
    );
  }
  return { starter, pro };
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Stripe webhook verification is not configured. Set STRIPE_WEBHOOK_SECRET.",
    );
  }
  return secret;
}

export function getApplicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the public Talk Tutor origin.");
  }
  const url = new URL(configured);
  if (
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a safe public application origin.");
  }
  return url.origin;
}

function formBody(
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    form.set(key, String(value));
  }
  return form;
}

async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    fields?: Record<
      string,
      string | number | boolean | null | undefined
    >;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({
    Authorization: `Bearer ${stripeSecretKey()}`,
    Accept: "application/json",
  });
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  const response = await fetch(
    `${STRIPE_API_BASE}/${path.replace(/^\/+/, "")}`,
    {
      method,
      headers,
      body:
        method === "POST"
          ? formBody(options.fields ?? {})
          : undefined,
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "Stripe request failed.";
    throw new StripeApiError(message, response.status);
  }

  return payload as T;
}

export async function assertStripePriceMatchesPlan(
  planId: PaidPlanId,
): Promise<string> {
  const priceId = getStripePriceConfig()[planId];
  const price = await stripeRequest<{
    id?: unknown;
    active?: unknown;
    currency?: unknown;
    unit_amount?: unknown;
    recurring?: {
      interval?: unknown;
      interval_count?: unknown;
    } | null;
  }>(`prices/${encodeURIComponent(priceId)}`);

  const plan = getPlanDefinition(planId);
  if (
    !plan ||
    price.id !== priceId ||
    price.active !== true ||
    price.currency !== plan.currency ||
    price.unit_amount !== plan.monthlyPriceCents ||
    price.recurring?.interval !== "month" ||
    (price.recurring?.interval_count !== undefined &&
      price.recurring.interval_count !== 1)
  ) {
    throw new Error(
      `Configured Stripe price for ${planId} does not match the Talk Tutor plan definition.`,
    );
  }

  return priceId;
}

export async function createStripeCustomer(input: {
  userId: string;
  email?: string;
}) {
  return stripeRequest<{ id: string }>("customers", {
    method: "POST",
    idempotencyKey: `talk-tutor-customer-${input.userId}`,
    fields: {
      email: input.email,
      "metadata[userId]": input.userId,
    },
  });
}

export async function createStripeCheckoutSession(input: {
  userId: string;
  customerId: string;
  planId: PaidPlanId;
  priceId: string;
}) {
  if (!isPaidPlanId(input.planId)) {
    throw new Error("Only paid plans can create a Stripe Checkout session.");
  }

  const origin = getApplicationOrigin();
  return stripeRequest<{ id: string; url: string | null }>(
    "checkout/sessions",
    {
      method: "POST",
      fields: {
        mode: "subscription",
        customer: input.customerId,
        client_reference_id: input.userId,
        success_url: `${origin}/billing?checkout=success`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
        "line_items[0][price]": input.priceId,
        "line_items[0][quantity]": 1,
        "metadata[userId]": input.userId,
        "metadata[planId]": input.planId,
        "subscription_data[metadata][userId]": input.userId,
        "subscription_data[metadata][planId]": input.planId,
      },
    },
  );
}

export async function createStripeBillingPortalSession(
  customerId: string,
) {
  const origin = getApplicationOrigin();
  return stripeRequest<{ id: string; url: string }>(
    "billing_portal/sessions",
    {
      method: "POST",
      fields: {
        customer: customerId,
        return_url: `${origin}/billing`,
      },
    },
  );
}

export async function retrieveStripeSubscription(
  subscriptionId: string,
): Promise<unknown> {
  if (!subscriptionId || subscriptionId.length > 255) {
    throw new Error("Invalid Stripe subscription id.");
  }
  return stripeRequest(
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
}
