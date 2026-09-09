import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlanDefinition, PAID_PLAN_IDS } from '../../lib/billing/plans.ts';
import { getFreeBillingPeriod } from '../../lib/billing/periods.ts';
import { calculateUsedSeconds, overlapSeconds, usageWarningLevel } from '../../lib/billing/usage.ts';
import { resolveEntitlement } from '../../lib/billing/entitlements.ts';

test('plan definitions are the single explicit initial business model', () => {
  assert.deepEqual(getPlanDefinition('free'), {
    id: 'free', name: 'Free', monthlyMinutes: 30, monthlyPriceCents: 0, currency: 'usd',
  });
  assert.deepEqual(getPlanDefinition('starter'), {
    id: 'starter', name: 'Starter', monthlyMinutes: 150, monthlyPriceCents: 900, currency: 'usd',
  });
  assert.deepEqual(getPlanDefinition('pro'), {
    id: 'pro', name: 'Pro', monthlyMinutes: 400, monthlyPriceCents: 1900, currency: 'usd',
  });
  assert.equal(getPlanDefinition('enterprise'), null);
  assert.deepEqual(PAID_PLAN_IDS, ['starter', 'pro']);
});

test('free billing period is a UTC calendar month', () => {
  const period = getFreeBillingPeriod(new Date('2026-09-09T12:30:00+05:00'));
  assert.deepEqual(period, {
    start: '2026-09-01T00:00:00.000Z',
    end: '2026-10-01T00:00:00.000Z',
  });
});

test('usage overlap is exact in seconds and handles period boundaries', () => {
  const start = '2026-09-01T00:00:00.000Z';
  const end = '2026-10-01T00:00:00.000Z';
  assert.equal(overlapSeconds('2026-08-31T23:59:00Z', '2026-09-01T00:00:00Z', start, end), 0);
  assert.equal(overlapSeconds('2026-09-01T00:00:00Z', '2026-09-01T00:00:01Z', start, end), 1);
  assert.equal(overlapSeconds('2026-09-01T00:00:00Z', '2026-09-01T00:00:59Z', start, end), 59);
  assert.equal(overlapSeconds('2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z', start, end), 60);
  assert.equal(overlapSeconds('2026-09-01T00:00:00Z', '2026-09-01T00:01:01Z', start, end), 61);
  assert.equal(overlapSeconds('2026-08-31T23:59:30Z', '2026-09-01T00:00:30Z', start, end), 30);
  assert.equal(overlapSeconds('2026-09-30T23:59:30Z', '2026-10-01T00:00:30Z', start, end), 30);
});

test('usage aggregation ignores invalid/non-overlapping rows instead of inventing time', () => {
  const used = calculateUsedSeconds([
    { startedAt: '2026-09-01T00:00:00Z', endedAt: '2026-09-01T00:01:01Z' },
    { startedAt: '2026-08-31T23:59:30Z', endedAt: '2026-09-01T00:00:30Z' },
    { startedAt: 'bad', endedAt: '2026-09-02T00:00:00Z' },
  ], { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' });
  assert.equal(used, 91);
});

test('usage warning thresholds distinguish 80%, 90%, and exhaustion', () => {
  assert.equal(usageWarningLevel(79, 100), null);
  assert.equal(usageWarningLevel(80, 100), 'warning');
  assert.equal(usageWarningLevel(90, 100), 'critical');
  assert.equal(usageWarningLevel(100, 100), 'exhausted');
  assert.equal(usageWarningLevel(101, 100), 'exhausted');
});

const paidAccount = {
  planId: 'starter',
  status: 'active',
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
};

test('entitlement resolves paid status, remaining seconds, and cancel-at-period-end correctly', () => {
  const result = resolveEntitlement({
    now: new Date('2026-09-09T00:00:00Z'),
    billingAccount: { ...paidAccount, cancelAtPeriodEnd: true },
    usageEvents: [{ startedAt: '2026-09-08T00:00:00Z', endedAt: '2026-09-08T00:10:00Z' }],
  });
  assert.equal(result.planId, 'starter');
  assert.equal(result.allowanceSeconds, 150 * 60);
  assert.equal(result.usedSeconds, 600);
  assert.equal(result.remainingSeconds, 8400);
  assert.equal(result.canStartTutor, true);
  assert.equal(result.cancelAtPeriodEnd, true);
});

test('past_due remains paid through its period while expired/unpaid/unknown state resolves Free', () => {
  const pastDue = resolveEntitlement({
    now: new Date('2026-09-09T00:00:00Z'),
    billingAccount: { ...paidAccount, planId: 'pro', status: 'past_due' },
    usageEvents: [],
  });
  assert.equal(pastDue.planId, 'pro');

  for (const account of [
    { ...paidAccount, status: 'unpaid' },
    { ...paidAccount, status: 'incomplete' },
    { ...paidAccount, planId: 'made-up' },
    { ...paidAccount, currentPeriodEnd: '2026-09-08T23:59:59Z' },
  ]) {
    const value = resolveEntitlement({
      now: new Date('2026-09-09T00:00:00Z'),
      billingAccount: account,
      usageEvents: [],
    });
    assert.equal(value.planId, 'free');
    assert.equal(value.allowanceSeconds, 30 * 60);
  }
});

test('exact or exceeded allowance blocks a new tutor session', () => {
  const exact = resolveEntitlement({
    now: new Date('2026-09-09T00:00:00Z'),
    billingAccount: paidAccount,
    usageEvents: [{ startedAt: '2026-09-01T00:00:00Z', endedAt: '2026-09-01T02:30:00Z' }],
  });
  assert.equal(exact.remainingSeconds, 0);
  assert.equal(exact.canStartTutor, false);
});


test('Stripe subscription snapshots map only configured application prices', async () => {
  const { mapStripeSubscriptionSnapshot } = await import('../../lib/billing/stripe-events.ts');
  const subscription = {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    current_period_start: 1788825600,
    current_period_end: 1791417600,
    cancel_at_period_end: true,
    metadata: { userId: '11111111-1111-4111-8111-111111111111' },
    items: { data: [{ price: { id: 'price_starter' } }] },
  };
  assert.deepEqual(
    mapStripeSubscriptionSnapshot(subscription, {
      starter: 'price_starter',
      pro: 'price_pro',
    }),
    {
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      planId: 'starter',
      status: 'active',
      currentPeriodStart: '2026-09-08T00:00:00.000Z',
      currentPeriodEnd: '2026-10-08T00:00:00.000Z',
      cancelAtPeriodEnd: true,
      metadataUserId: '11111111-1111-4111-8111-111111111111',
    },
  );
  assert.equal(
    mapStripeSubscriptionSnapshot(
      {
        ...subscription,
        items: { data: [{ price: { id: 'price_unknown' } }] },
      },
      { starter: 'price_starter', pro: 'price_pro' },
    ),
    null,
  );
});

test('Stripe event filter accepts only subscription synchronization events', async () => {
  const { isRelevantStripeEventType } = await import('../../lib/billing/stripe-events.ts');
  for (const type of [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]) {
    assert.equal(isRelevantStripeEventType(type), true, type);
  }
  assert.equal(isRelevantStripeEventType('invoice.payment_succeeded'), false);
  assert.equal(isRelevantStripeEventType('charge.succeeded'), false);
});

test('Stripe webhook signature verification checks timestamp, payload and tolerance', async () => {
  const { createHmac } = await import('node:crypto');
  const { verifyStripeWebhookSignature } = await import('../../lib/billing/stripe-events.ts');
  const payload = '{"id":"evt_123","type":"customer.subscription.updated"}';
  const secret = 'whsec_test';
  const timestamp = 1788940000;
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  const header = `t=${timestamp},v1=${digest}`;

  assert.equal(
    verifyStripeWebhookSignature(payload, header, secret, timestamp + 30),
    true,
  );
  assert.equal(
    verifyStripeWebhookSignature(payload + 'x', header, secret, timestamp + 30),
    false,
  );
  assert.equal(
    verifyStripeWebhookSignature(payload, header, secret, timestamp + 600),
    false,
  );
});

test('tutor token policy caps a session at remaining entitlement and rejects exhaustion', async () => {
  const { buildTutorTokenPolicy } = await import('../../lib/billing/token-policy.ts');

  assert.deepEqual(
    buildTutorTokenPolicy({ remainingSeconds: 0 }),
    {
      allowed: false,
      maxSessionSeconds: 0,
      warningAtSeconds: 0,
      reason: 'usage_limit',
    },
  );

  assert.deepEqual(
    buildTutorTokenPolicy({ remainingSeconds: 300 }),
    {
      allowed: true,
      maxSessionSeconds: 300,
      warningAtSeconds: 180,
      reason: 'usage_limit',
    },
  );

  assert.deepEqual(
    buildTutorTokenPolicy({ remainingSeconds: 3600 }),
    {
      allowed: true,
      maxSessionSeconds: 600,
      warningAtSeconds: 480,
      reason: 'provider_limit',
    },
  );
});
