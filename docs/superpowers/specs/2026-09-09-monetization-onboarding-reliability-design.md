# Monetization, Onboarding & Reliability — Design

**Date:** 2026-09-09  
**Repository:** `salman0butt/talk-tutor`  
**Base branch:** `main`  
**Base SHA:** `37b9eb4f36ae7847c9f5367c5b99b0cf03b7ad73`  
**Feature branch:** `feat/monetization-onboarding-reliability`

## 1. Goal

Move Talk Tutor from a persistent AI language-learning product to a production-oriented SaaS with:

- understandable monthly plans and real Stripe subscriptions;
- server-enforced realtime tutor entitlements;
- authoritative, idempotent usage accounting;
- a fast onboarding path that configures a useful first practice session;
- deterministic browser/microphone diagnostics and bounded recovery;
- graceful session-limit handling that preserves transcripts and learning history.

Correctness and security take priority over billing/UI convenience.

## 2. Existing architecture retained

The implementation extends the merged system instead of replacing it:

- Next.js 16 App Router + React 19.
- Supabase Auth accessed through server-managed HTTP-only session cookies.
- Supabase REST/RPC persistence with learner-owned RLS.
- Existing `profiles`, `learning_sessions`, `session_messages`, `session_feedback`, vocabulary tables, dashboard and personalized-practice models.
- Existing `LearningSessionRecorder` as the application session persistence boundary.
- Existing `LiveManager` generation guards, cleanup path, transcript reducer, audio pipeline and Zustand lifecycle.
- Existing Gemini client-to-server ephemeral-token architecture.

No microservices, Redis, queues, generic billing framework, generic onboarding engine, or state-machine library are introduced.

## 3. Business rules

### Plans

The initial monthly plans are deliberately small and explicit:

| Plan | Price | Included realtime conversation |
| --- | ---: | ---: |
| Free | $0 | 30 minutes/month |
| Starter | $9/month | 150 minutes/month |
| Pro | $19/month | 400 minutes/month |

Authoritative usage is stored and calculated in seconds.

Application plan identifiers are `free`, `starter`, and `pro`. Stripe price IDs never become application plan identifiers.

### Billing periods

- Free: UTC calendar month `[month_start, next_month_start)`.
- Paid: Stripe subscription `current_period_start/current_period_end`.
- No destructive monthly reset job exists.
- A session spanning a period boundary contributes only the overlapping seconds to that period.

### Subscription entitlement policy

Paid entitlement is granted only when:

1. the stored Stripe subscription maps to a known paid application plan;
2. the current billing period has not ended; and
3. status is `active`, `trialing`, or `past_due`.

`past_due` remains entitled through the current period to avoid abruptly terminating learning while Stripe retries payment. `incomplete`, `incomplete_expired`, `unpaid`, `paused`, ended/deleted subscriptions, unknown statuses, or expired periods resolve to Free.

`cancel_at_period_end=true` does not remove paid entitlement before `current_period_end`.

### Usage exhaustion

- At 80% and 90%, UI shows increasing warnings.
- At zero remaining time, `/api/token` rejects before issuing Gemini access.
- During a live session, the client receives the server-derived remaining seconds and warns two minutes before the smaller of the remaining allowance and the supported provider session limit.
- At the boundary, the app performs its normal controlled disconnect/finalization path; transcript/session persistence completes before the UI returns to a restart/upgrade state.
- There is no indefinite overage.

## 4. Usage accounting

### Source of truth

Usage is represented by a `tutor_usage_events` row linked one-to-one to a finalized `learning_session`.

Each event stores:

- `learning_session_id` (unique);
- `user_id`;
- server-derived `started_at`;
- server-derived `ended_at`;
- `duration_seconds`;
- `created_at`.

The existing `finalize_learning_session` database function already obtains `ended_at = now()`, computes duration from database timestamps, and is idempotent for an already-finalized session. The migration extends that transaction to insert the usage event with `ON CONFLICT (learning_session_id) DO NOTHING`.

The usage resolver computes overlap against the active period rather than repeatedly adding floating-point minutes.

### Hardening existing session writes

Billing must not trust learner-supplied duration/status values. Therefore direct authenticated INSERT/UPDATE privileges on `learning_sessions` and direct INSERT on `session_messages` are removed. Existing session RPCs become focused `SECURITY DEFINER` functions that:

- derive the owner from `auth.uid()`;
- validate ownership and input;
- write server timestamps;
- keep `search_path = ''`;
- remain the only mutation path used by the application.

Learners retain RLS-protected SELECT access.

### Honest limitation

The browser connects directly to Gemini with an ephemeral token. Without proxying all realtime audio through a Talk Tutor server or receiving provider-side billable-duration callbacks, the application cannot cryptographically prove every second of an intentionally modified client session. This milestone makes normal application usage server-derived, auditable, idempotent, and resistant to ordinary client field manipulation, while explicitly not claiming provider-grade metering.

## 5. Concurrent tutor starts

A small `tutor_session_leases` table prevents two normal app tabs from simultaneously minting realtime tokens.

- Primary key: `user_id`.
- Lease ID: random UUID.
- `started_at` and `expires_at` use database time.
- Expired leases may be replaced.
- A unique insert is the atomic concurrency guard; no distributed lock service is needed.
- Lease lifetime is capped to the actual session authorization window.
- The token endpoint obtains/releases leases through service-role-only RPCs after authenticating the user and resolving entitlement.
- If Gemini token creation fails, the server releases the just-created lease.
- The client releases the lease only through an authenticated server route during controlled cleanup.

The lease is a concurrency guard, not the usage ledger.

## 6. Billing data model

A single `billing_accounts` row per user stores the Stripe mapping and current subscription snapshot:

- `user_id` primary key;
- unique nullable `stripe_customer_id`;
- unique nullable `stripe_subscription_id`;
- nullable paid `plan_id`;
- `status`;
- `current_period_start`;
- `current_period_end`;
- `cancel_at_period_end`;
- timestamps.

A `stripe_webhook_events` table stores successfully processed event IDs for duplicate detection.

RLS:

- authenticated users may SELECT only their own `billing_accounts`;
- authenticated users may SELECT only their own usage events;
- no authenticated INSERT/UPDATE/DELETE exists for billing account, Stripe event, lease, or usage-ledger tables;
- trusted writes use a server-only Supabase service-role boundary.

No "free subscription row" is created. Missing/invalid paid billing state naturally resolves to Free.

## 7. Stripe boundary

Use current `stripe` Node SDK, server-only.

Environment:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `SUPABASE_SERVICE_ROLE_KEY`
- existing `NEXT_PUBLIC_APP_URL`

No Stripe.js/publishable key is needed for hosted Checkout + Billing Portal.

### Checkout

`POST /api/billing/checkout` accepts only an application plan ID. Server code:

1. authenticates user;
2. maps allowed paid plan ID to central plan definition and configured Stripe Price ID;
3. verifies the Stripe Price is active, recurring monthly, USD, and equals the configured display amount;
4. gets/reuses the user's Stripe customer;
5. creates customer with a stable Stripe idempotency key when missing;
6. creates hosted subscription Checkout;
7. sets server-controlled success/cancel URLs and user/plan metadata.

The client never supplies amount, currency, customer ID, Stripe price ID, or subscription owner.

### Webhooks

`POST /api/billing/webhook` reads `request.text()` before parsing and verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.

Subscription snapshots are synchronized from:

- `checkout.session.completed`;
- `customer.subscription.created`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`.

Invoice failure does not need a second entitlement model because Stripe subscription status updates remain authoritative; the UI can still show a past-due message from synchronized status.

Writes are idempotent upserts. A webhook event ID is recorded only after successful processing; duplicate delivery after completion becomes a no-op. Concurrent duplicate delivery may repeat an idempotent upsert but cannot create duplicate subscription state.

### Billing portal

`POST /api/billing/portal` accepts no customer identifier. The server resolves the authenticated user's stored customer and creates a Stripe Billing Portal session.

## 8. Entitlement API and UI

Pure modules:

- `lib/billing/plans.ts` — public-safe plan metadata.
- `lib/billing/periods.ts` — free and subscription periods.
- `lib/billing/usage.ts` — interval overlap and display rounding.
- `lib/billing/entitlements.ts` — status/plan/remaining-time decisions.
- `lib/billing/server.ts` — authenticated repository orchestration.
- `lib/billing/stripe.ts` — Stripe client + price mapping.
- `lib/supabase/admin.ts` — service-role REST/RPC boundary.

Server view model:

```ts
{
  planId,
  planName,
  status,
  allowanceSeconds,
  usedSeconds,
  remainingSeconds,
  periodStart,
  periodEnd,
  cancelAtPeriodEnd,
  isPaid,
  canStartTutor
}
```

Usage meters consume this model; React never recalculates subscription rules.

Pages/components:

- public `/pricing`;
- authenticated `/billing`;
- compact meter on dashboard;
- compact availability/remaining-time state in Tutor;
- Billing link in application navigation.

## 9. Onboarding

### Backward compatibility

Profiles gain:

- `onboarding_completed_at`;
- `placement_completed_at`;
- `placement_score`;
- `recommended_level`.

The migration backfills `onboarding_completed_at` for profiles that already exist before this feature. New profiles remain incomplete.

Existing learners are therefore never unexpectedly trapped in onboarding.

### Flow

One mobile-first route, `/onboarding`, with three useful steps:

1. Goal
2. Level
3. Recommendation

Required learner-facing goals map to canonical profile values:

- Travel -> `travel`
- Job -> `interview_preparation`
- School -> `academic_language`
- Immigration -> new canonical value `immigration`

Legacy goal values remain valid for existing profiles.

### Placement

Six deterministic objective questions cover basic comprehension, vocabulary, and grammar. No AI call is made.

Scoring:

- 0–2: `Basic`
- 3–4: `Intermediate`
- 5–6: `Top Class`

The UI calls this an "Estimated level" / "Recommended starting level", never certification.

The learner can use the result or override it.

### Recommendations

Deterministic goal + level mappings select:

- a starting topic/scenario;
- conversation difficulty:
  - Basic -> easy
  - Intermediate -> normal
  - Top Class -> challenging.

Examples reuse the existing scenario library where possible:
- Travel -> Airport check-in;
- Job -> Job interview;
- School -> presentation/classroom-oriented custom practice;
- Immigration -> daily-life/government/appointment-oriented practice.

Completion persists canonical profile values and routes directly to a preconfigured `/tutor` URL.

## 10. Onboarding routing

The authenticated learning layout and Tutor route use one helper to decide onboarding eligibility.

- If `onboarding_completed_at` exists: continue normally.
- Existing profiles are backfilled complete by migration.
- New profiles created after migration: redirect to `/onboarding`.
- `/onboarding` itself creates/reads the profile and never loops.
- Sign-up may continue targeting `/dashboard`; the authenticated learning layout redirects a newly created learner to onboarding.

## 11. Reliability

### Error taxonomy

Live errors become explicit categories:

- `microphone_permission_denied`
- `microphone_not_found`
- `microphone_unavailable`
- `unsupported_browser`
- `audio_context_failed`
- `audio_worklet_failed`
- `network`
- `token`
- `provider`
- `session_timeout`
- `usage_limit`
- `session_closed`
- `audio_decode_failed`
- `unknown`

Pure classification and user-message mapping live outside React.

### Compatibility

Preflight uses feature detection, not UA allowlists:

- secure context (except localhost browser semantics);
- `navigator.mediaDevices`;
- `getUserMedia`;
- `AudioContext`;
- `AudioWorkletNode`.

Critical failure disables Start and offers a clear explanation.

### Microphone diagnostics

Diagnostics run only while disconnected, so they do not create a second capture pipeline during a live session.

A temporary stream:

1. requests microphone permission;
2. exposes safe device label after permission;
3. creates one AudioContext/analyser;
4. reports a normalized signal level;
5. stops all tracks and closes AudioContext on close/error.

States distinguish unsupported API, permission denied, no device/open failure, connected-but-no-signal, and working signal.

### Retry

No infinite automatic retry exists.

- Token/network/provider transient errors offer a user-driven Try Again.
- Permission denied, unsupported browser, invalid configuration, and usage exhaustion are not auto-retried.
- Existing generation guards continue preventing parallel connection attempts and stale callbacks.

### Provider timeout

Current Gemini Live documentation (verified 2026-09-09) states:

- audio-only sessions without context compression are limited to 15 minutes;
- WebSocket connections are around 10 minutes and can emit `GoAway`;
- session resumption is needed for seamless continuation.

This milestone does not claim resumption support unless the installed SDK path is implemented and tested. Therefore a single Talk Tutor session is bounded to the lower provider connection-safe window: a warning appears before the boundary and the existing controlled finalization path ends cleanly. A later isolated milestone may add resumption/context compression.

## 12. Security

P0 checks:

- token endpoint re-resolves entitlement on every attempt; no stale client plan flag;
- no arbitrary customer/subscription IDs accepted from clients;
- no client Stripe amount/currency/price authority;
- webhook signature verified against raw body;
- billing tables have read-only own-user RLS and no authenticated mutations;
- service-role key is server-only;
- checkout/portal return URLs are fixed from configured application origin;
- usage ledger derives server timestamps and unique session linkage;
- direct mutation of billing-authoritative session status/duration is removed;
- onboarding free text remains untrusted tutor data through the existing structured prompt boundary;
- logs never include keys, tokens, card data, raw audio, or full transcripts.

## 13. Testing strategy

Strict red/green tests for deterministic modules:

Billing:
- plan definitions and unknown plan;
- free/paid periods;
- interval overlap: 0/1/59/60/61 seconds, exact limit, over-limit, cross-period session;
- subscription statuses and cancel-at-period-end;
- remaining usage and thresholds;
- plan/price input validation.

Onboarding:
- goal validation;
- placement 0–6 boundaries;
- result override;
- deterministic topic/difficulty mapping;
- legacy profile behavior.

Reliability:
- feature detection;
- microphone/DOM error classification;
- transient vs non-retryable policy;
- timeout/warning calculation;
- usage-limit error mapping.

Database:
- schema constraints and indexes;
- read-only billing RLS;
- usage-event idempotency;
- server-timestamp finalization;
- duplicate session finalization;
- cross-user isolation;
- active lease concurrency;
- existing-user onboarding backfill.

Integration:
- token route authorization paths use focused server helpers;
- Stripe webhook signature path and idempotent synchronization are covered through pure event-to-snapshot helpers plus route build/type validation.

The repository CI remains the evidence gate: frozen install, lint, typecheck, unit tests, SQL migration/RLS/runtime tests, production build.

Real Stripe hosted pages and physical microphone permission/signal behavior require configured test credentials and a real browser; these are reported as manual verification if the environment cannot execute them.

## 14. Migration strategy

One additive migration follows the existing two migrations.

It:
- expands profile goal constraint for `immigration`;
- adds onboarding/placement columns;
- backfills existing profiles as onboarding-complete;
- creates billing/usage/lease/webhook tables;
- hardens session mutation grants/functions;
- extends session finalization to create exactly one usage event;
- creates service-role-only lease functions;
- applies RLS/grants/indexes.

No existing learner data is deleted or renamed.

## 15. Definition of done

The branch is ready for PR only when fresh evidence shows:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- SQL migration + schema/RLS/runtime tests
- `pnpm build`

all succeed on the exact branch head; a dedicated review finds no unresolved Critical/Important issues; environment limitations are documented; commits are pushed and a PR is opened against `main` without merging it.
