import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaidPlanId } from "./plans.ts";

export type StripePriceConfig = Record<PaidPlanId, string>;

export const RELEVANT_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export type RelevantStripeEventType =
  (typeof RELEVANT_STRIPE_EVENT_TYPES)[number];

const RELEVANT_EVENT_SET = new Set<string>(RELEVANT_STRIPE_EVENT_TYPES);
const STRIPE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export function isRelevantStripeEventType(
  value: unknown,
): value is RelevantStripeEventType {
  return typeof value === "string" && RELEVANT_EVENT_SET.has(value);
}

function stringId(value: unknown): string | null {
  if (typeof value === "string" && value.length >= 3 && value.length <= 255) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string"
  ) {
    return stringId((value as { id: string }).id);
  }
  return null;
}

function stripeTimestamp(value: unknown): string | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 253402300799
  ) {
    return null;
  }
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface StripeSubscriptionSnapshot {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planId: PaidPlanId;
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  metadataUserId: string | null;
}

export function mapStripeSubscriptionSnapshot(
  value: unknown,
  priceConfig: StripePriceConfig,
): StripeSubscriptionSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;

  const stripeSubscriptionId = stringId(data.id);
  const stripeCustomerId = stringId(data.customer);
  const status = typeof data.status === "string" ? data.status : null;
  const currentPeriodStart = stripeTimestamp(data.current_period_start);
  const currentPeriodEnd = stripeTimestamp(data.current_period_end);

  const items =
    data.items && typeof data.items === "object" && !Array.isArray(data.items)
      ? (data.items as Record<string, unknown>)
      : null;
  const itemData = Array.isArray(items?.data) ? items.data : [];
  const firstItem =
    itemData[0] && typeof itemData[0] === "object" && !Array.isArray(itemData[0])
      ? (itemData[0] as Record<string, unknown>)
      : null;
  const priceId = stringId(firstItem?.price);

  const planId = Object.entries(priceConfig).find(
    ([, configuredPriceId]) => configuredPriceId === priceId,
  )?.[0] as PaidPlanId | undefined;

  if (
    !stripeSubscriptionId ||
    !stripeCustomerId ||
    !status ||
    !STRIPE_SUBSCRIPTION_STATUSES.has(status) ||
    !currentPeriodStart ||
    !currentPeriodEnd ||
    Date.parse(currentPeriodEnd) <= Date.parse(currentPeriodStart) ||
    !planId
  ) {
    return null;
  }

  const metadata =
    data.metadata &&
    typeof data.metadata === "object" &&
    !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : null;
  const metadataUserId =
    typeof metadata?.userId === "string" && metadata.userId.length <= 128
      ? metadata.userId
      : null;

  return {
    stripeCustomerId,
    stripeSubscriptionId,
    planId,
    status: status as StripeSubscriptionSnapshot["status"],
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    metadataUserId,
  };
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (
    !rawBody ||
    !signatureHeader ||
    !webhookSecret ||
    !Number.isFinite(nowSeconds) ||
    !Number.isFinite(toleranceSeconds) ||
    toleranceSeconds < 0
  ) {
    return false;
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === "t") {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) timestamp = parsed;
    } else if (key === "v1" && /^[0-9a-f]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }

  if (
    timestamp === null ||
    signatures.length === 0 ||
    Math.abs(nowSeconds - timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();

  return signatures.some((candidate) => {
    const received = Buffer.from(candidate, "hex");
    return (
      received.length === expected.length &&
      timingSafeEqual(received, expected)
    );
  });
}
