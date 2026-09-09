import {
  resolveEntitlement,
  type BillingAccountSnapshot,
  type EntitlementSnapshot,
} from "@/lib/billing/entitlements";
import { readSupabaseJson, supabaseRestFetch } from "@/lib/supabase/rest";

type BillingAccountRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

type UsageRow = {
  started_at: string;
  ended_at: string;
};

export interface BillingAccount {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  planId: string | null;
  status: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapBillingAccountRow(
  row: BillingAccountRow,
): BillingAccount {
  return {
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planId: row.plan_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function billingAccountSnapshot(
  account: BillingAccount | null,
): BillingAccountSnapshot | null {
  if (!account) return null;
  return {
    planId: account.planId,
    status: account.status,
    currentPeriodStart: account.currentPeriodStart,
    currentPeriodEnd: account.currentPeriodEnd,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
  };
}

export class BillingRepository {
  constructor(
    private readonly userId: string,
    private readonly accessToken: string,
  ) {}

  async getBillingAccount(): Promise<BillingAccount | null> {
    const response = await supabaseRestFetch(
      `billing_accounts?select=*&user_id=eq.${this.userId}&limit=1`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<BillingAccountRow[]>(response);
    return rows[0] ? mapBillingAccountRow(rows[0]) : null;
  }

  async getEntitlement(now = new Date()): Promise<EntitlementSnapshot> {
    const account = await this.getBillingAccount();
    const empty = resolveEntitlement({
      now,
      billingAccount: billingAccountSnapshot(account),
      usageEvents: [],
    });

    const start = encodeURIComponent(empty.periodStart);
    const end = encodeURIComponent(empty.periodEnd);
    const response = await supabaseRestFetch(
      `tutor_usage_events?select=started_at,ended_at&user_id=eq.${this.userId}&started_at=lt.${end}&ended_at=gt.${start}&order=ended_at.asc`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<UsageRow[]>(response);
    const usageEvents = rows
      .filter(
        (row) =>
          typeof row.started_at === "string" &&
          typeof row.ended_at === "string",
      )
      .map((row) => ({
        startedAt: row.started_at,
        endedAt: row.ended_at,
      }));

    return resolveEntitlement({
      now,
      billingAccount: billingAccountSnapshot(account),
      usageEvents,
    });
  }

  async getViewModel(now = new Date()) {
    const [account, entitlement] = await Promise.all([
      this.getBillingAccount(),
      this.getEntitlement(now),
    ]);

    return {
      account,
      entitlement,
      hasBillingCustomer: Boolean(account?.stripeCustomerId),
    };
  }
}
