# Talk Tutor

Talk Tutor is a voice-first language-learning application built around real conversations. Learners can speak with a live Gemini-powered tutor, save their practice history, review transcripts and coaching feedback, track progress, revisit vocabulary with spaced repetition, and choose practice sessions based on their goals and recurring mistakes.

The application is built with Next.js, React, TypeScript, Gemini Live, Supabase and Stripe. It is designed as a complete SaaS product rather than a standalone voice demo: authentication, onboarding, billing, usage limits, persistence, progress tracking, vocabulary review, AI quality checks and production-oriented security are all part of the same codebase.

## What the app includes

### Live speaking practice

The main tutor experience lives at `/tutor`.

Learners can:

- have a real-time voice conversation with Gemini Live;
- choose a target language and regional variant;
- choose a tutor voice;
- choose Basic, Intermediate or Top Class difficulty;
- select how often the tutor should correct them;
- switch between normal conversation, roleplay, custom practice and Practice My Mistakes;
- choose from predefined topics and scenarios;
- use a custom topic or situation;
- select an input microphone;
- mute and unmute during a session;
- see live connection and tutor state;
- see streaming transcript updates while speaking;
- have finalized learner and tutor turns saved to their account.

The application currently uses:

- Gemini Live model: `gemini-2.5-flash-native-audio-preview-12-2025`;
- 16 kHz microphone input handling;
- 24 kHz Gemini audio output;
- one active tutor session per account;
- a maximum live connection of 10 minutes at a time, or the learner's remaining allowance when that is lower;
- a warning two minutes before the current session limit.

Talk Tutor does not store raw audio recordings. Persisted session review is transcript-based.

### Supported languages

The current tutor configuration includes:

| Language | Region |
| --- | --- |
| English | United States |
| English | United Kingdom |
| Spanish | Spain |
| Spanish | Mexico |
| French | France |
| German | Germany |
| Japanese | Japan |
| Korean | South Korea |
| Chinese | China / Mandarin |
| Hindi | India |
| Portuguese | Brazil |

### Tutor voices

The current Gemini voices exposed in the UI are:

- Charon — informative
- Puck — upbeat
- Kore — firm
- Fenrir — excitable
- Aoede — confident

### Onboarding and placement

New authenticated learners are sent through a three-step onboarding flow before using the tutor.

The flow asks the learner to:

1. choose a practical goal;
2. answer six short placement questions;
3. review the recommended starting level and first practice suggestion.

The supported onboarding goals are Travel, Job, School and Immigration.

Placement is intentionally deterministic. The six answers are scored in application code and mapped to:

- 0–2 correct: Basic
- 3–4 correct: Intermediate
- 5–6 correct: Top Class

The learner can still choose a different starting level before completing onboarding. The placement result is a starting recommendation, not a certification or standardized language score.

### Learning profile

The profile page stores learner defaults across sessions and devices.

A learner can save:

- preferred language;
- proficiency level;
- tutor voice;
- correction frequency;
- conversation difficulty;
- primary learning goal;
- daily practice target from 5 to 180 minutes;
- IANA timezone.

The timezone is used for streaks, practice-day boundaries and progress calculations.

### Practice modes

Talk Tutor supports four practice modes.

**Conversation** is a normal open conversation around the selected topic.

**Roleplay** places the learner and tutor into a specific situation. Built-in scenarios include coffee shop, restaurant, meeting someone new, airport check-in, hotel check-in, lost luggage, job interview, client call, team meeting and professional networking.

**Practice My Mistakes** uses recurring grammar categories from saved feedback to create practice opportunities around the learner's weaker areas.

**Custom** lets the learner provide a topic or situation while still keeping that text inside the application's untrusted prompt-data boundary.

Correction frequency can be set to Minimal, Balanced or Frequent. Conversation difficulty can be Easy, Normal or Challenging.

### Session history and transcripts

Completed sessions are available in `/history`.

Session history includes:

- target language;
- topic;
- duration;
- number of learner turns;
- finalized transcript;
- feedback status;
- feedback summary;
- text-derived fluency coaching score when available.

A database learning session is not created simply because the learner opens the tutor. The recorder waits until there is a finalized learner turn, then persists the session and subsequent finalized messages. This avoids empty or accidental history entries.

Session finalization is idempotent, so repeated disconnect/finalize paths do not create duplicate usage entries.

### Post-session coaching feedback

After a completed session, Talk Tutor can generate structured Gemini feedback that includes:

- a session summary;
- grammar corrections;
- better sentence suggestions;
- useful vocabulary;
- a text-derived fluency coaching score and explanation;
- practical next steps.

The offline feedback model defaults to `gemini-2.5-flash` and can be overridden with `GEMINI_FEEDBACK_MODEL`.

Feedback is intentionally separate from the success of the conversation itself. If feedback generation fails, the completed session remains valid and reviewable, and feedback can be retried later.

The current feedback system does not make pronunciation claims from text transcripts. Pronunciation notes are removed because there is no persisted acoustic evidence supporting them.

### AI guardrails and evaluation

Learner-facing AI feedback is validated before it can influence saved learning history.

Each new grammar correction must identify the learner transcript turn it came from using `sourceSequence`. The application checks that:

- the referenced sequence exists;
- the source turn belongs to the learner rather than the tutor;
- the claimed original text actually appears in that learner turn after conservative normalization;
- the proposed correction is not identical to the original.

Unsupported corrections are discarded before persistence.

The prompt also treats transcript, topic, learner history and other learner-controlled values as untrusted data. Gemini structured output is validated again in application code even when the provider schema succeeds.

Deterministic AI regression cases live in `evals/feedback-grounding.json` and run as part of the normal test suite. They include grounded corrections, hallucinated corrections, assistant-sourced evidence, no-op corrections, prompt injection, normalization, Spanish and German cases.

For the design rationale and the rules for future prompt/model changes, see:

- `docs/architecture/ai-quality-foundation.md`
- `docs/architecture/ai-guardrails-evals.md`
- `docs/architecture/ai-quality-engineering-playbook.md`
- `evals/README.md`

### Dashboard and progress

The authenticated dashboard combines persisted practice data into a practical learning overview.

It currently shows:

- total practice minutes;
- practice time this week and month;
- completed sessions;
- sessions completed this week;
- current and longest streak;
- active practice days;
- saved vocabulary;
- vocabulary due for review;
- new vocabulary this week;
- weekly practice history;
- vocabulary growth;
- recurring mistake categories;
- recent languages;
- recent text-derived fluency scores;
- recommended next practice;
- recent sessions;
- current live-conversation allowance.

A streak day requires at least one completed session with a learner turn and at least 60 seconds of practice. Multiple qualifying sessions on the same local day count as one streak day.

Skill trends are only shown after enough completed scored sessions exist. The current fluency values are coaching signals derived from transcript text; they are not acoustic measurements, exam scores or scientific proficiency grades.

### Personalized recommendations

Recommended practice is deterministic application logic rather than another LLM call.

Recommendations can prioritize:

- vocabulary that is due for review;
- recurring mistake categories;
- remaining daily practice target;
- a roleplay that matches the learner's saved goal;
- a normal conversation when there is no stronger recommendation.

This keeps recommendation ordering predictable and easy to test.

### Vocabulary library and spaced repetition

Learners can save useful words from session feedback into their vocabulary library.

The vocabulary area includes:

- saved words and meanings;
- source context;
- personalized example sentences;
- optional AI-generated examples;
- review status;
- due dates;
- review history;
- Learning and Strong states.

Vocabulary review uses a deterministic simplified SM-2 style schedule. The browser submits only the learner's review rating; authoritative scheduling values are calculated and persisted by PostgreSQL.

A word becomes Strong only after the required successful review history and interval threshold. It does not mean the application is claiming permanent mastery.

### Billing and usage

Talk Tutor has three monthly plans:

| Plan | Price | Live conversation allowance |
| --- | ---: | ---: |
| Free | $0 | 30 minutes |
| Starter | $9/month | 150 minutes |
| Pro | $19/month | 400 minutes |

Paid checkout and subscription management use Stripe-hosted pages.

The billing area shows:

- current plan;
- subscription status;
- current-period allowance;
- used and remaining conversation time;
- cancellation-at-period-end state;
- upgrade actions;
- a link to the Stripe Billing Portal for paid customers.

Talk Tutor stores Stripe customer/subscription identifiers and status, but does not store card details.

Tutor authorization uses the same server-resolved entitlement state shown on the billing page. When the remaining allowance reaches zero, the token endpoint refuses to start another live session.

Usage is recorded in exact seconds when a learning session is finalized.

### Authentication and account security

Authentication uses Supabase Email authentication.

The app includes:

- sign up;
- sign in;
- email confirmation;
- sign out;
- forgot password;
- reset password;
- protected authenticated routes;
- secure HttpOnly access and refresh cookies.

Learner-owned data is accessed with the authenticated learner's Supabase access token and remains protected by PostgreSQL Row Level Security.

The Supabase service-role key is used only in server-only code for trusted operations such as Stripe synchronization and tutor-session leases. It must never be exposed to the browser or prefixed with `NEXT_PUBLIC_`.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/pricing` | Free, Starter and Pro plans |
| `/signup` | Create an account |
| `/login` | Sign in |
| `/forgot-password` | Request password reset |
| `/auth/reset-password` | Complete password reset |
| `/onboarding` | Goal selection and placement |
| `/tutor` | Live speaking practice |
| `/dashboard` | Progress, recommendations and usage |
| `/history` | Completed sessions |
| `/history/[sessionId]` | Transcript and coaching feedback |
| `/vocabulary` | Saved vocabulary |
| `/vocabulary/review` | Spaced-repetition review |
| `/profile` | Learner preferences |
| `/billing` | Plan, subscription and usage |

## Technology stack

The main application stack is:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Google GenAI SDK
- Gemini Live
- Supabase Auth
- PostgreSQL / Supabase
- Stripe Checkout and Billing Portal
- React Three Fiber / Three.js for tutor visualization
- Node's built-in test runner
- GitHub Actions

## Getting started

### Prerequisites

For local development you need:

- Node.js 22 or later;
- pnpm 10;
- a Supabase project;
- a Gemini API key;
- a Stripe account if you want billing and paid-plan flows to work;
- Supabase CLI if you want to apply migrations from the command line;
- Stripe CLI if you want to forward webhooks during local development.

### 1. Clone and install

```bash
git clone https://github.com/salman0butt/talk-tutor.git
cd talk-tutor
pnpm install
```

### 2. Create the local environment file

```bash
cp .env.example .env.local
```

The current environment variables are:

```env
# Gemini Live and post-session feedback
GEMINI_API_KEY=
GEMINI_FEEDBACK_MODEL=gemini-2.5-flash

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=

# Application origin
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Gemini variables

`GEMINI_API_KEY` is required for the live tutor and post-session feedback.

`GEMINI_FEEDBACK_MODEL` is optional. When omitted, feedback uses `gemini-2.5-flash`.

#### Supabase variables

`NEXT_PUBLIC_SUPABASE_URL` is the project URL.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is the project's browser-safe anon/publishable key.

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is required by the current billing synchronization and tutor-session lease implementation. Never expose this key in client code, logs or public environment variables.

#### Stripe variables

`STRIPE_SECRET_KEY` is the server-side Stripe secret key.

`STRIPE_WEBHOOK_SECRET` is the signing secret for the Talk Tutor webhook endpoint.

`STRIPE_PRICE_STARTER` must point to an active recurring monthly USD price for $9.

`STRIPE_PRICE_PRO` must point to an active recurring monthly USD price for $19.

The checkout code validates that the configured Stripe price matches the plan amount, currency and monthly billing interval defined in the application.

`NEXT_PUBLIC_APP_URL` is used for authentication redirects, metadata and Stripe return URLs. Set it to the deployed HTTPS origin in production.

## Supabase setup

### 1. Create a project

Create a Supabase project and enable Email authentication.

### 2. Configure authentication URLs

For local development, add these redirect URLs in Supabase Auth:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`

Set the Site URL to your local app while developing, and add the equivalent HTTPS URLs for production.

### 3. Link the project

If you are using the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. Apply migrations

Run:

```bash
supabase db push
```

The current migrations are applied in this order:

1. `20260909000000_learning_platform.sql` — learner profiles, learning sessions, transcript messages, session feedback, core RLS and session RPCs;
2. `20260909090000_personalized_learning_vocabulary.sql` — personalized practice fields, progress data, vocabulary, reviews and spaced-repetition functions;
3. `20260909150000_monetization_onboarding_reliability.sql` — onboarding metadata, billing accounts, usage events, Stripe webhook idempotency, tutor leases and hardened session mutation permissions.

There is no separate AI-quality database migration. Feedback guardrails and evals are application-level behavior and the existing `grammar_corrections` column is JSONB.

### 5. Keep the service-role key server-side

The service-role key bypasses normal RLS and is intentionally restricted to server-only modules. Do not expose it through a `NEXT_PUBLIC_` variable or send it to the browser.

Normal learner reads and writes still use the authenticated learner's access token and RLS wherever possible.

## Stripe setup

Stripe is needed for Starter and Pro subscriptions.

### 1. Create the recurring prices

Create two active monthly USD prices:

- Starter: $9/month
- Pro: $19/month

Copy their price IDs into:

```env
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

### 2. Configure the webhook

The application webhook endpoint is:

```text
/api/billing/webhook
```

For a deployed app, create a Stripe webhook endpoint such as:

```text
https://your-domain.com/api/billing/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

### 3. Local Stripe webhooks

With the Stripe CLI installed:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Use the signing secret printed by the CLI as your local `STRIPE_WEBHOOK_SECRET`.

The webhook handler verifies the raw-body signature, ignores unrelated events, records processed event IDs for idempotency and synchronizes subscription state into Supabase.

## Run the application

Start the development server:

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

A normal first-time flow is:

1. create an account;
2. confirm the email if email confirmation is enabled;
3. sign in;
4. complete onboarding;
5. choose the recommended level or another starting level;
6. start a live tutor session;
7. finish the session;
8. review it in History;
9. save useful vocabulary;
10. use Dashboard and Vocabulary Review for follow-up practice.

## Useful scripts

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm test` runs billing, onboarding, learning, live-conversation and deterministic AI eval tests.

## Testing and CI

GitHub Actions runs the main verification suite for pull requests and `main`.

The workflow currently checks:

- dependency installation;
- ESLint;
- TypeScript;
- unit/domain tests;
- deterministic AI guardrail evals through the normal test suite;
- Supabase migrations against PostgreSQL 17;
- database schema assertions;
- RLS and ownership runtime tests;
- production Next.js build.

The database CI environment uses a minimal Supabase-compatible auth stub. It is useful for migration, RLS and ownership verification, but it does not replace testing against the real configured Supabase project before production deployment.

Before opening or merging a change, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Data and security model

Talk Tutor stores learner-owned application data in Supabase/Postgres.

Important boundaries include:

- authenticated learner data is protected by RLS;
- direct mutation of sensitive session data is restricted in favor of owner-aware database functions;
- billing-authoritative changes are handled by server-only code;
- Stripe webhook signatures are verified before synchronization;
- processed webhook IDs are stored to make synchronization idempotent;
- one normal tutor lease is allowed per learner at a time;
- live Gemini tokens are minted server-side after checking entitlement;
- learner-controlled prompt context is treated as untrusted data;
- structured AI output is validated before persistence;
- unsupported AI grammar corrections are discarded;
- raw audio is not persisted;
- card/payment details remain with Stripe.

## Project structure

The main areas of the repository are:

```text
app/                  Next.js pages and API routes
components/           Product UI
lib/auth.ts           Authentication helpers
lib/billing/          Plans, Stripe integration, entitlements and usage
lib/learning/         Learning domain, persistence, progress and practice logic
lib/live/             Realtime transcript/session behavior
lib/onboarding/       Placement and onboarding recommendations
services/             Gemini Live session manager
store/                Client-side tutor state
supabase/migrations/  Database migrations
supabase/tests/       Schema and RLS verification
tests/                Unit and domain tests
evals/                AI quality fixtures and eval policy
docs/                 Architecture, security and implementation documentation
```

## Architecture and maintenance docs

Start with these documents when working on the codebase:

- `docs/architecture/learning-platform.md` — persistent learner/session architecture;
- `docs/architecture/live-conversation.md` — voice session, transcript, playback and interruption behavior;
- `docs/architecture/personalized-learning-vocabulary.md` — progress, practice modes and vocabulary scheduling;
- `docs/security/learning-platform.md` — data ownership and RLS model;
- `docs/architecture/ai-engineering-maturity-audit.md` — broader AI engineering audit;
- `docs/architecture/ai-quality-foundation.md` — current AI-quality implementation;
- `docs/architecture/ai-guardrails-evals.md` — guardrails and eval architecture;
- `docs/architecture/ai-quality-engineering-playbook.md` — what, why, how and when to use each AI quality practice;
- `evals/README.md` — AI eval tiers and release policy.

## Current product boundaries

A few limits are deliberate in the current version:

- live voice sessions are capped at 10 minutes per connection;
- monthly conversation time is plan-limited;
- one live tutor session can be active per account;
- audio recordings are not stored;
- pronunciation is not scored from text;
- fluency is a transcript-derived coaching signal, not an exam score;
- placement is a six-question starting-level recommendation, not a standardized assessment;
- recommendations, progress calculations and spaced repetition are deterministic rather than LLM-driven;
- AI evals currently include deterministic Tier-1 guardrail regression tests; full live-model semantic and human-calibrated evals are documented as the next quality tier.

## Deployment checklist

Before deploying a new environment, verify:

- all environment variables are configured;
- `NEXT_PUBLIC_APP_URL` points to the deployed HTTPS origin;
- Supabase Auth Site URL and redirect URLs include the deployed domain;
- all three database migrations have been applied;
- the Supabase service-role key is available only to server runtime;
- Stripe Starter and Pro price IDs match the application's $9 and $19 monthly plan definitions;
- the Stripe webhook points to `/api/billing/webhook`;
- the webhook signing secret is correct;
- Gemini API access is configured;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## License

No license file is currently included in this repository. Add one before treating the project as a publicly licensed open-source package.
