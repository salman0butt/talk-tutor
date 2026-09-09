import "server-only";

import {
  readSupabaseAdminJson,
  supabaseAdminFetch,
} from "@/lib/supabase/admin";
import {
  mapBillingAccountRow,
  type BillingAccount,
} from "@/lib/billing/repository";
import type { StripeSubscriptionSnapshot } from "@/lib/billing/stripe-events";
import { isUuid } from "@/lib/learning/validation";

type BillingAccountRow = Parameters<typeof mapBillingAccountRow>[0];

async function getAccount(resource: string): Promise<BillingAccount | null> {
  const response = await supabaseAdminFetch(resource);
  const rows = await readSupabaseAdminJson<BillingAccountRow[]>(response);
  return rows[0] ? mapBillingAccountRow(rows[0]) : null;
}

export async function getAdminBillingAccountByUserId(
  userId: string,
): Promise<BillingAccount | null> {
  if (!isUuid(userId)) return null;
  return getAccount(
    `billing_accounts?select=*&user_id=eq.${userId}&limit=1`,
  );
}

export async function getAdminBillingAccountByCustomerId(
  customerId: string,
): Promise<BillingAccount | null> {
  if (!customerId || customerId.length > 255) return null;
  return getAccount(
    `billing_accounts?select=*&stripe_customer_id=eq.${encodeURIComponent(customerId)}&limit=1`,
  );
}

export async function recordStripeCustomer(
  userId: string,
  customerId: string,
): Promise<BillingAccount> {
  if (!isUuid(userId) || !customerId) {
    throw new Error("Invalid billing customer identity.");
  }

  const response = await supabaseAdminFetch(
    "billing_accounts?on_conflict=user_id",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }),
      prefer: "resolution=merge-duplicates,return=representation",
    },
  );
  const rows = await readSupabaseAdminJson<BillingAccountRow[]>(response);
  if (!rows[0]) throw new Error("Billing customer could not be persisted.");
  return mapBillingAccountRow(rows[0]);
}

export async function syncStripeSubscription(
  userId: string,
  snapshot: StripeSubscriptionSnapshot,
): Promise<BillingAccount> {
  if (!isUuid(userId)) {
    throw new Error("Invalid billing owner.");
  }

  const response = await supabaseAdminFetch(
    "billing_accounts?on_conflict=user_id",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        stripe_customer_id: snapshot.stripeCustomerId,
        stripe_subscription_id: snapshot.stripeSubscriptionId,
        plan_id: snapshot.planId,
        status: snapshot.status,
        current_period_start: snapshot.currentPeriodStart,
        current_period_end: snapshot.currentPeriodEnd,
        cancel_at_period_end: snapshot.cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      }),
      prefer: "resolution=merge-duplicates,return=representation",
    },
  );

  const rows = await readSupabaseAdminJson<BillingAccountRow[]>(response);
  if (!rows[0]) throw new Error("Stripe subscription could not be persisted.");
  return mapBillingAccountRow(rows[0]);
}

export async function isStripeWebhookProcessed(
  eventId: string,
): Promise<boolean> {
  if (!eventId || eventId.length > 255) return false;
  const response = await supabaseAdminFetch(
    `stripe_webhook_events?select=event_id&event_id=eq.${encodeURIComponent(eventId)}&limit=1`,
  );
  const rows = await readSupabaseAdminJson<Array<{ event_id: string }>>(
    response,
  );
  return rows.length > 0;
}

export async function markStripeWebhookProcessed(
  eventId: string,
  eventType: string,
): Promise<void> {
  const response = await supabaseAdminFetch("stripe_webhook_events", {
    method: "POST",
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
    }),
    prefer: "return=minimal",
  });

  if (response.status === 409) return;
  if (!response.ok) {
    await readSupabaseAdminJson(response);
  }
}

export async function acquireTutorSessionLease(
  userId: string,
  ttlSeconds: number,
): Promise<string | null> {
  if (!isUuid(userId)) throw new Error("Invalid tutor lease owner.");
  const response = await supabaseAdminFetch(
    "rpc/acquire_tutor_session_lease",
    {
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_ttl_seconds: ttlSeconds,
      }),
    },
  );
  const leaseId = await readSupabaseAdminJson<string | null>(response);
  return isUuid(leaseId) ? leaseId : null;
}

export async function releaseTutorSessionLease(
  userId: string,
  leaseId: string,
): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(leaseId)) return false;
  const response = await supabaseAdminFetch(
    "rpc/release_tutor_session_lease",
    {
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_lease_id: leaseId,
      }),
    },
  );
  return readSupabaseAdminJson<boolean>(response);
}
