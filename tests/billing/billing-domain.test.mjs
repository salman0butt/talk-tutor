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
