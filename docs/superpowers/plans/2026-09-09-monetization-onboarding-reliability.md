# Monetization, Onboarding & Reliability — Implementation Plan

> **Execution rule:** Use strict TDD for deterministic behavior, keep each production change behind a failing test, and run fresh verification before every completion/PR claim.

**Goal:** Ship production-quality monetization, onboarding and realtime reliability on top of merged `main` without rebuilding completed SaaS/learning/tutor work.

**Base:** `main@37b9eb4f36ae7847c9f5367c5b99b0cf03b7ad73`  
**Branch:** `feat/monetization-onboarding-reliability`

## Task 1 — Billing domain: plans, periods, usage, entitlements

**Files**
- Create `lib/billing/plans.ts`
- Create `lib/billing/periods.ts`
- Create `lib/billing/usage.ts`
- Create `lib/billing/entitlements.ts`
- Create `tests/billing/plans.test.mjs`
- Create `tests/billing/usage.test.mjs`
- Create `tests/billing/entitlements.test.mjs`
- Update `package.json` test glob

**RED**
- Assert Free/Starter/Pro definitions and immutable seconds.
- Assert UTC free-month period.
- Assert interval overlap at 0/1/59/60/61 sec and across period boundary.
- Assert exact-limit and over-limit behavior.
- Assert Stripe status policy and cancel-at-period-end behavior.
- Assert unknown/expired plan resolves Free.

**GREEN**
- Implement only pure functions needed by tests.

## Task 2 — Onboarding domain: placement and recommendations

**Files**
- Create `lib/onboarding/placement.ts`
- Create `lib/onboarding/recommendations.ts`
- Create `tests/onboarding/placement.test.mjs`
- Create `tests/onboarding/recommendations.test.mjs`
- Extend `lib/learning/types.ts`
- Extend `lib/learning/validation.ts`

**RED**
- Six-question deterministic placement scoring.
- Boundary scores 0–2 Basic, 3–4 Intermediate, 5–6 Top Class.
- Travel/Job/School/Immigration validation.
- Recommended difficulty mapping.
- Stable recommended scenario/topic per goal.
- Learner override remains valid.

**GREEN**
- Add goal metadata and pure scoring/recommendation logic.

## Task 3 — Reliability domain: compatibility, errors, timeout policy

**Files**
- Create `lib/live/compatibility.ts`
- Create `lib/live/errors.ts`
- Create `lib/live/session-policy.ts`
- Create `tests/live/compatibility.test.mjs`
- Create `tests/live/errors.test.mjs`
- Create `tests/live/session-policy.test.mjs`
- Extend `types.ts`

**RED**
- Unsupported media APIs.
- insecure-context classification.
- permission denied/no-device/device-busy/audio-context/worklet/network/provider categories.
- retryable vs non-retryable errors.
- warning/end thresholds using 10-minute safe provider connection boundary and remaining allowance.

**GREEN**
- Implement feature detection and pure policies.

## Task 4 — Database migration and RLS

**Files**
- Create `supabase/migrations/20260909150000_monetization_onboarding_reliability.sql`
- Create `supabase/tests/monetization_onboarding_schema.sql`
- Create `supabase/tests/monetization_onboarding_rls_runtime.sql`
- Update `.github/workflows/ci.yml`

**RED**
- Add SQL assertions before applying implementation migration in CI branch sequence.
- Assert expected billing/onboarding objects are absent/fail under base migrations.

**GREEN migration**
- Extend `profiles` goal constraint with `immigration`.
- Add onboarding/placement metadata.
- Backfill existing profiles as onboarding-complete.
- Create `billing_accounts`, `tutor_usage_events`, `stripe_webhook_events`, `tutor_session_leases`.
- Read-own RLS for billing account/usage.
- No authenticated mutations on billing/usage/lease/webhook tables.
- Harden session mutations behind security-definer RPCs.
- Extend `finalize_learning_session` to insert one usage event.
- Service-role-only lease acquire/release RPCs.
- Constraints/indexes/ownership checks.

## Task 5 — Supabase admin boundary and billing repositories

**Files**
- Create `lib/supabase/admin.ts`
- Create `lib/billing/repository.ts`
- Create `lib/billing/server.ts`
- Add focused pure normalization tests where possible.

**RED**
- Normalize malformed billing rows safely.
- Entitlement server orchestration rejects missing auth.
- Usage rows are converted only from server-shaped valid data.

**GREEN**
- Add server-only service-role fetch/RPC helper.
- Add authenticated read-only billing repository.
- Build one entitlement resolver used by UI and token authorization.

## Task 6 — Stripe dependency and focused boundary

**Files**
- Update `package.json`
- Update `pnpm-lock.yaml`
- Create `lib/billing/stripe.ts`
- Create `lib/billing/stripe-events.ts`
- Create `tests/billing/stripe-events.test.mjs`
- Update `.env.example`

**RED**
- Known price ID -> application plan mapping.
- Unknown Stripe price -> no paid plan.
- Subscription snapshot extraction.
- Event type filtering.
- Checkout input allows only Starter/Pro.

**GREEN**
- Add `stripe@22.6.1`.
- Centralize server-only Stripe client and price configuration.
- Add Stripe snapshot/event mapping without leaking SDK objects into domain code.

## Task 7 — Stripe Checkout, Portal and webhook routes

**Files**
- Create `app/api/billing/checkout/route.ts`
- Create `app/api/billing/portal/route.ts`
- Create `app/api/billing/webhook/route.ts`

**Behavior**
- Checkout authenticates user, validates application plan, verifies configured Stripe price amount/currency/interval, reuses customer, and creates hosted subscription Checkout.
- Portal resolves customer only from own billing account.
- Webhook verifies raw-body signature, synchronizes relevant subscription events, then marks event processed.
- Safe fixed application return URLs; no client-controlled redirects.

**Verification**
- Typecheck/build plus pure Stripe event tests.
- Manual Stripe test-mode flow documented if credentials unavailable in CI.

## Task 8 — Token entitlement + concurrent start enforcement

**Files**
- Refactor `app/api/token/route.ts`
- Add `app/api/token/release/route.ts`
- Extend billing server/repository helpers.
- Extend `store/useAudioStore.ts`

**RED**
- Pure authorization decision: 0 seconds -> denied, positive -> allowed/capped.
- Lease-conflict maps to deterministic concurrent-session error.
- Failed token creation releases lease through server helper.

**GREEN**
- Authenticate.
- Resolve fresh entitlement.
- Reject exhausted before Gemini token mint.
- Acquire one per-user lease.
- Mint token.
- Release lease on token failure.
- Return lease + authoritative usage/session limits.

## Task 9 — Usage meter, pricing and billing UX

**Files**
- Create `components/billing/usage-meter.tsx`
- Create `components/billing/checkout-button.tsx`
- Create `components/billing/manage-billing-button.tsx`
- Create `app/pricing/page.tsx`
- Create `app/(learn)/billing/page.tsx`
- Update `app/(learn)/dashboard/page.tsx`
- Update `components/app-nav.tsx`

**Behavior**
- Public pricing from central safe plan metadata.
- Billing page shows current plan/status/allowance/usage/period/cancellation state.
- Dashboard shows compact meter.
- Upgrade/manage actions use server routes.
- Responsive, keyboard accessible, textual progress alternatives.

## Task 10 — Onboarding persistence and routing

**Files**
- Extend `lib/learning/types.ts`
- Extend `lib/learning/repository.ts`
- Extend `lib/learning/server.ts`
- Extend `lib/learning/validation.ts`
- Create `app/api/onboarding/route.ts`
- Create `app/onboarding/page.tsx`
- Create `components/onboarding/onboarding-flow.tsx`
- Update `app/(learn)/layout.tsx`
- Update `app/tutor/page.tsx`
- Update `proxy.ts`

**RED**
- New profile incomplete; existing/backfilled profile complete.
- Completion payload is server-scored.
- Unsupported goal/answer/level rejected.
- Selected level override persists without changing score/recommendation.
- Completion produces safe Tutor handoff configuration.

**GREEN**
- Dedicated completion route persists goal, placement fields, proficiency and recommended difficulty.
- Layout/Tutor redirect new profiles to onboarding.
- Onboarding route never redirects itself.
- Existing users remain unaffected.

## Task 11 — Tutor reliability integration

**Files**
- Refactor `services/liveManager.ts`
- Refactor `store/useAudioStore.ts`
- Update `components/status-panel.tsx`
- Update `components/controls-panel.tsx`
- Update `components/tutor-session-lifecycle.tsx`
- Create `components/microphone-diagnostics.tsx`
- Add/extend live tests.

**RED**
- Unsupported browser blocks Start before token request.
- Permission-denied does not auto retry.
- Token/network/provider transient error returns to retryable ERROR.
- Session timer warns and triggers one controlled disconnect.
- Usage exhaustion maps to upgrade state.
- Cleanup releases lease once.
- Diagnostic cleanup stops tracks/closes AudioContext.

**GREEN**
- Structured error state.
- Preflight feature detection.
- User-driven retry action.
- Microphone diagnostic dialog/inline panel.
- Usage/provider timeout timer.
- Existing LiveManager generation/cleanup remains authoritative.

## Task 12 — Provider boundary hardening

**Files**
- Update `services/liveManager.ts`
- Extend Gemini normalization only if installed SDK exposes GoAway cleanly.
- Extend tests around close/error semantics.

**Rules**
- Do not claim session resumption unless implemented against current SDK and tested.
- Current product session is bounded to provider-safe 10-minute connection duration.
- Warn two minutes before end.
- Provider early close finalizes cleanly and does not double-finalize usage.

## Task 13 — Documentation

**Files**
- Create `docs/architecture/billing.md`
- Create `docs/architecture/onboarding.md`
- Create `docs/architecture/tutor-reliability.md`
- Create/update `docs/security/billing.md`
- Update `README.md`
- Update `.env.example`

Document:
- plan rules and prices;
- storage in seconds + display rounding;
- free and paid billing periods;
- subscription-status policy;
- cancel-at-period-end;
- usage limitations of direct browser-to-provider architecture;
- Stripe local/test setup;
- onboarding scoring;
- compatibility requirements;
- 10/15-minute Gemini constraints and chosen policy.

## Task 14 — Full verification

Use fresh exact-head evidence:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
# SQL migration/schema/RLS/runtime suite
pnpm build
```

CI is the execution environment if local repository/network access is unavailable.

Do not extrapolate a pass from an earlier commit.

## Task 15 — Dedicated review

Review exact `BASE_SHA...HEAD_SHA` through independent lenses:

1. billing/usage correctness;
2. Stripe security/idempotency;
3. Supabase/RLS/IDOR;
4. onboarding/backward compatibility;
5. realtime lifecycle/resource cleanup;
6. React/Next server-client boundaries;
7. tests/CI/docs.

Fix every Critical and Important finding using failing regression tests first.

## Task 16 — Finish branch

Re-run full verification on the reviewed exact head.

Then:

- push/update `feat/monetization-onboarding-reliability`;
- create a Pull Request against `main`;
- include exact verification SHA/run;
- list Stripe/Supabase configuration still required;
- leave the Pull Request open;
- do **not** merge.
