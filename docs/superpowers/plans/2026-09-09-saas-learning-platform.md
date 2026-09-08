# Talk Tutor SaaS Learning Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent learner preferences, durable tutor sessions, structured post-session feedback, session review, and a real-data progress dashboard on top of PR #1.

**Architecture:** Preserve PR #1's HttpOnly Supabase Auth REST architecture. Use authenticated PostgREST requests with the user's access token, RLS on every learner-owned table, finalized-turn session persistence, server-side Gemini structured feedback, and Server Components for read-heavy history/dashboard surfaces.

**Tech Stack:** Next.js 16.1.6 App Router, React 19, TypeScript 5, Tailwind 4, Zustand 5, Supabase/Postgres/PostgREST, Gemini `@google/genai`, Node 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-09-saas-learning-platform-design.md`

**Stacked base:** `feat/saas-home-auth@0e902d709db3a9c8b33617156e2e66df7d379b0b`

## Global constraints

- PR #1 stays open and unmerged.
- Work stays on `feat/saas-learning-platform` and the final PR targets `feat/saas-home-auth`.
- No service-role key is required or exposed.
- All learner ownership is derived from the server-side authenticated session.
- RLS is mandatory on profile, session, transcript, and feedback tables.
- Empty Tutor visits/connections must not create learning sessions.
- Only finalized transcript turns are persisted.
- A practice day requires a completed session with at least one user message and at least 60 seconds duration.
- Streak boundaries use the profile's IANA timezone.
- Text transcripts never produce acoustic pronunciation claims; V1 pronunciation notes remain empty.
- Feedback model output is untrusted until local schema validation succeeds.
- Feedback failure never invalidates the completed session.
- No audio recording/replay, flashcards/SRS, queues, Redis, or materialized analytics in this milestone.
- Strict TDD for new business logic: test first, observe the intended failure, implement minimally, re-run green, then refactor.
- No completion/merge-readiness claims without fresh lint/test/build evidence.

## File map

### Database
- `supabase/migrations/20260909000000_learning_platform.sql` — tables, constraints, indexes, RLS, dashboard aggregate RPC.
- `supabase/tests/learning_platform_rls.sql` — documented optional database integration checks for a local Supabase stack.

### Pure learning domain
- `lib/learning/types.ts` — profile/session/feedback/dashboard contracts.
- `lib/learning/validation.ts` — profile input, UUID, transcript, feedback validation.
- `lib/learning/analytics.ts` — timezone-aware streak, vocabulary normalization, mistake/trend aggregation.
- `lib/learning/session-lifecycle.ts` — deterministic recorder lifecycle/duration rules.
- `lib/learning/errors.ts` — small typed errors for safe route responses.
- `tests/learning/*.test.mjs` — behavior tests against the pure TypeScript modules.

### Supabase/server data
- `lib/supabase/rest.ts` — authenticated PostgREST transport.
- `lib/learning/repository.ts` — owner-scoped profile/session/message/feedback/dashboard access.
- `lib/learning/server.ts` — authenticated server orchestration used by pages/routes.
- `lib/auth.ts` — expose safe access-token helper while preserving PR #1 auth behavior.

### Mutation routes
- `app/api/learning/profile/route.ts`
- `app/api/learning/sessions/route.ts`
- `app/api/learning/sessions/[sessionId]/messages/route.ts`
- `app/api/learning/sessions/[sessionId]/route.ts`
- `app/api/learning/sessions/[sessionId]/feedback/route.ts`

### Feedback
- `lib/learning/feedback/schema.ts`
- `lib/learning/feedback/prompt.ts`
- `lib/learning/feedback/provider.ts`
- `lib/learning/feedback/service.ts`

### Tutor integration
- `lib/learning/session-recorder.ts`
- `lib/learning/session-api.ts`
- `components/learning/profile-hydrator.tsx`
- `store/useAudioStore.ts`
- `services/liveManager.ts`
- `types.ts`
- `app/tutor/page.tsx`

### Authenticated product UI
- `components/app-shell.tsx`
- `components/app-nav.tsx`
- `components/profile/profile-form.tsx`
- `components/history/session-card.tsx`
- `components/history/session-transcript.tsx`
- `components/history/session-feedback.tsx`
- `components/dashboard/*.tsx`
- `app/(learn)/layout.tsx`
- `app/(learn)/dashboard/page.tsx`
- `app/(learn)/history/page.tsx`
- `app/(learn)/history/[sessionId]/page.tsx`
- `app/(learn)/profile/page.tsx`

### Verification/docs
- `proxy.ts` — protect the new authenticated routes/API namespace.
- `package.json` — add `typecheck` and Node built-in `test` scripts.
- `.github/workflows/ci.yml` — install/lint/typecheck/test/build.
- `.env.example` — document feedback model configuration if introduced.
- `README.md`
- `docs/architecture/learning-platform.md`
- `docs/security/learning-platform.md`

---

## Task 1: Define and verify deterministic learning-domain behavior

**Files:**
- Create: `tests/learning/validation.test.mjs`
- Create: `tests/learning/analytics.test.mjs`
- Create: `tests/learning/session-lifecycle.test.mjs`
- Create: `lib/learning/types.ts`
- Create: `lib/learning/validation.ts`
- Create: `lib/learning/analytics.ts`
- Create: `lib/learning/session-lifecycle.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing validation tests**

Cover:
- accepted profile values;
- rejected language/level/goal/daily-target/timezone inputs;
- valid and malformed UUIDs;
- empty/partial transcript rejection;
- structured feedback valid fixture;
- malformed/partially missing feedback rejection.

Production change that makes them pass: exported deterministic validators and types.

- [ ] **Step 2: Run the validation tests and capture RED**

Run:
`node --experimental-strip-types --test tests/learning/validation.test.mjs`

Expected: fail because the learning validation module/functions do not exist.

- [ ] **Step 3: Implement the smallest validators/types**

Use existing language/proficiency/voice constants as source values where possible. Keep feedback runtime validation dependency-free.

- [ ] **Step 4: Re-run validation tests GREEN**

- [ ] **Step 5: Write failing analytics tests**

Cover:
- first practice day;
- consecutive days;
- duplicate sessions on one day;
- missed day;
- month boundary;
- year boundary;
- timezone-sensitive local date conversion;
- vocabulary Unicode/case/whitespace normalization and dedupe;
- common mistake category aggregation;
- score trend aggregation.

- [ ] **Step 6: Run analytics tests RED**

- [ ] **Step 7: Implement analytics minimally**

Use `Intl.DateTimeFormat` with explicit `timeZone`. Current streak anchors on today if practiced, otherwise yesterday, then walks backward one local calendar day at a time.

- [ ] **Step 8: Re-run analytics tests GREEN**

- [ ] **Step 9: Write failing session lifecycle tests**

Cover:
- no session before a finalized user turn;
- assistant turn may buffer before first user turn;
- first finalized user turn causes exactly one create;
- subsequent finalized turns append in order;
- empty finalized text ignored;
- finalize without a created session does nothing;
- finalization is idempotent;
- duration is clamped to non-negative seconds;
- meaningful threshold is 60 seconds + user message.

- [ ] **Step 10: Run lifecycle tests RED**

- [ ] **Step 11: Implement lifecycle helpers minimally and run GREEN**

- [ ] **Step 12: Add package scripts**

`"test": "node --experimental-strip-types --test tests/**/*.test.mjs"`
`"typecheck": "tsc --noEmit"`

- [ ] **Step 13: Run the whole pure suite**

- [ ] **Step 14: Commit**

`test: define learning platform business rules` and/or `feat: add deterministic learning domain` as coherent red/green commits.

---

## Task 2: Add the Supabase persistence foundation and owner-scoped server repository

**Files:**
- Create: `supabase/migrations/20260909000000_learning_platform.sql`
- Create: `supabase/tests/learning_platform_rls.sql`
- Create: `lib/supabase/rest.ts`
- Create: `lib/learning/repository.ts`
- Create: `lib/learning/server.ts`
- Create: `tests/learning/ownership.test.mjs`
- Modify: `lib/auth.ts`

- [ ] **Step 1: Write failing ownership/request-shaping tests**

Test that:
- owner id always comes from authenticated context;
- arbitrary client `user_id` is not propagated;
- owned-session filters include both session id and authenticated user id;
- unauthenticated context is rejected;
- malformed session ids are rejected before a repository request.

- [ ] **Step 2: Run ownership tests RED**

- [ ] **Step 3: Implement auth/access-token and PostgREST helpers minimally**

Expose a server-only way to read the current access token from HttpOnly cookies without changing PR #1's cookie format.

- [ ] **Step 4: Re-run ownership tests GREEN**

- [ ] **Step 5: Write the migration**

Create:
- `profiles`
- `learning_sessions`
- `session_messages`
- `session_feedback`

Add:
- FKs and composite owner/session FKs;
- status/check constraints;
- JSON shape constraints;
- indexes;
- RLS;
- anon revocations;
- authenticated grants;
- per-operation ownership policies;
- `get_learning_dashboard()` security-invoker aggregate function that accepts no user id.

Dashboard RPC returns aggregated totals, weekly practice buckets, normalized vocabulary count, correction category counts, recent languages/scores, and distinct meaningful local practice dates. Streak itself remains TypeScript-tested.

- [ ] **Step 6: Add optional local Supabase RLS SQL checks**

Cover two-user ownership expectations and constraints. Clearly mark that these require a local Supabase test database and are not run in normal CI unless the environment provides it.

- [ ] **Step 7: Review migration security mechanically**

Check every table has RLS + policies + grants and every child FK carries owner identity.

- [ ] **Step 8: Commit**

`feat: add learning platform database foundation`

---

## Task 3: Persist learner profile/preferences and hydrate the Tutor

**Files:**
- Create: `app/api/learning/profile/route.ts`
- Create: `components/learning/profile-hydrator.tsx`
- Create: `components/profile/profile-form.tsx`
- Create: `app/(learn)/profile/page.tsx`
- Modify: `store/useAudioStore.ts`
- Modify: `app/tutor/page.tsx`
- Modify: `proxy.ts`

- [ ] **Step 1: Write failing pure tests for profile patch merging**

Test partial updates preserve unspecified fields and invalid fields are rejected.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement server profile orchestration**

GET lazily creates defaults if missing. PATCH accepts only validated profile fields and derives ownership from auth.

- [ ] **Step 4: Implement Tutor hydration**

Server page loads profile, passes tutor preferences into a tiny client hydrator, and Zustand exposes a one-time `hydratePreferences` action.

- [ ] **Step 5: Persist explicit language/level/voice selection changes**

Update local state first, then issue a small authenticated profile PATCH. Failure does not roll back the local selection.

- [ ] **Step 6: Add compact Profile UI**

Fields:
- preferred language
- proficiency
- voice
- goal
- daily target
- timezone with browser-timezone suggestion

Use accessible labels, focus states, save/error/success states.

- [ ] **Step 7: Protect `/profile` and learning API namespace**

Expand `proxy.ts` matcher while retaining handler-level auth checks.

- [ ] **Step 8: Run focused tests + typecheck**

- [ ] **Step 9: Commit**

`feat: add learner profile persistence`

---

## Task 4: Persist live tutoring sessions and finalized transcript turns

**Files:**
- Create: `lib/learning/session-api.ts`
- Create: `lib/learning/session-recorder.ts`
- Create: `app/api/learning/sessions/route.ts`
- Create: `app/api/learning/sessions/[sessionId]/messages/route.ts`
- Create: `app/api/learning/sessions/[sessionId]/route.ts`
- Modify: `store/useAudioStore.ts`
- Modify: `services/liveManager.ts`
- Modify: `types.ts`

- [ ] **Step 1: Add a failing recorder orchestration test using an injected fake API**

Verify buffered pre-user assistant turn, one create, ordered append, and idempotent finalization through the real recorder class.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement the recorder minimally**

Use an internal promise chain to serialize final-turn persistence and avoid create/append races.

- [ ] **Step 4: Run recorder test GREEN**

- [ ] **Step 5: Implement route handlers**

Create route receives tutor configuration plus initial finalized messages; server supplies owner id and start timestamp.

Message route validates finalized non-empty text and assigns/validates sequence ownership safely.

Finalize route calculates duration from persisted start time and server current time, completes idempotently, and never requires client user id.

- [ ] **Step 6: Integrate with existing Gemini lifecycle**

- clear transcript at the start of a fresh connection;
- begin recorder when a live session starts;
- send only `isPartial === false` turns to recorder;
- map `model` to persisted `assistant`;
- explicit disconnect awaits recorder finalization;
- unexpected LiveManager close/error makes a best-effort idempotent finalize.

- [ ] **Step 7: Run lifecycle/recorder tests + typecheck**

- [ ] **Step 8: Commit**

`feat: persist tutoring sessions`

---

## Task 5: Generate and persist structured post-session feedback

**Files:**
- Create: `lib/learning/feedback/schema.ts`
- Create: `lib/learning/feedback/prompt.ts`
- Create: `lib/learning/feedback/provider.ts`
- Create: `lib/learning/feedback/service.ts`
- Create: `tests/learning/feedback-service.test.mjs`
- Create: `app/api/learning/sessions/[sessionId]/feedback/route.ts`
- Modify: session finalization route

- [ ] **Step 1: Write failing feedback orchestration tests**

Fixtures:
- valid provider JSON persists;
- malformed JSON rejected;
- structurally incomplete payload rejected;
- provider failure marks feedback failed but keeps session completed;
- empty transcript does not invoke provider;
- prompt serialization treats transcript as delimited untrusted data;
- pronunciation notes from text-only provider output are discarded/forced empty.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement prompt/schema/provider boundary minimally**

Use existing `@google/genai` with JSON response schema. Limit transcript characters/turns and escape through JSON serialization.

- [ ] **Step 4: Run tests GREEN**

- [ ] **Step 5: Implement service orchestration and route**

Ownership is checked by authenticated repository access before model invocation.

Finalization marks feedback pending for a non-empty completed session and schedules generation with Next.js `after()` so the disconnect response is not blocked by the model. Manual feedback route supports retry of failed/pending feedback.

- [ ] **Step 6: Run feedback tests + typecheck**

- [ ] **Step 7: Commit**

`feat: generate structured session feedback`

---

## Task 6: Add session history and educational session review

**Files:**
- Create: `components/app-shell.tsx`
- Create: `components/app-nav.tsx`
- Create: `app/(learn)/layout.tsx`
- Create: `app/(learn)/history/page.tsx`
- Create: `app/(learn)/history/[sessionId]/page.tsx`
- Create: `app/(learn)/history/loading.tsx`
- Create: `components/history/session-card.tsx`
- Create: `components/history/session-transcript.tsx`
- Create: `components/history/session-feedback.tsx`
- Modify: `components/navbar.tsx` only as needed to keep Tutor navigation coherent
- Modify: `proxy.ts`

- [ ] **Step 1: Add server data helpers for history/detail**

Return only current-user rows. Missing/foreign IDs collapse to the same not-found result.

- [ ] **Step 2: Build authenticated app shell/navigation**

Desktop and mobile navigation includes Dashboard, Practice, History, Profile, Logout and reuses the PR #1 dark/amber visual language.

- [ ] **Step 3: Build History page**

Display real date/language/topic/duration/level/feedback state with empty state. No audio controls.

- [ ] **Step 4: Build Session detail**

Educational order:
1. overview + stats
2. overall feedback
3. grammar corrections
4. better sentence suggestions
5. vocabulary
6. next steps
7. transcript

Gracefully handle feedback pending/failed/missing.

- [ ] **Step 5: Add loading/error/not-found states and accessibility pass**

- [ ] **Step 6: Run lint/typecheck/tests**

- [ ] **Step 7: Commit**

`feat: add session history and review`

---

## Task 7: Add real-data learner progress analytics and premium dashboard

**Files:**
- Create: `app/(learn)/dashboard/page.tsx`
- Create: `app/(learn)/dashboard/loading.tsx`
- Create: `components/dashboard/metric-card.tsx`
- Create: `components/dashboard/weekly-practice.tsx`
- Create: `components/dashboard/skill-progress.tsx`
- Create: `components/dashboard/common-mistakes.tsx`
- Create: `components/dashboard/vocabulary-growth.tsx`
- Create: `components/dashboard/recent-sessions.tsx`
- Modify: `lib/learning/server.ts`
- Modify: `proxy.ts`

- [ ] **Step 1: Write/extend failing dashboard snapshot normalization tests**

Validate malformed/missing RPC fields fall back safely rather than fabricating data.

- [ ] **Step 2: Run RED, implement normalization, run GREEN**

- [ ] **Step 3: Load dashboard snapshot + recent sessions**

Use the aggregate RPC for totals/common mistakes/vocabulary/weekly data; compute streak and coaching-score trend through tested TypeScript helpers.

- [ ] **Step 4: Build dashboard**

Show only supported metrics:
- total practiced minutes
- completed sessions
- sessions this week
- current streak
- weekly practice bars
- coaching score trend when feedback exists
- common mistake categories
- unique vocabulary count
- recent languages/sessions

No fake seed values.

- [ ] **Step 5: Add zero-data states**

New user gets a clear Practice CTA and no misleading zero-score skill judgments.

- [ ] **Step 6: Run lint/typecheck/tests**

- [ ] **Step 7: Commit**

`feat: add learner progress dashboard`

---

## Task 8: Harden CI, documentation, security review, and final verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/architecture/learning-platform.md`
- Create: `docs/security/learning-platform.md`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: any files required by review findings

- [ ] **Step 1: Add CI workflow**

Triggers on pushes/PRs relevant to the stacked branch. Use Node 22, Corepack, frozen pnpm install, lint, typecheck, test, build.

- [ ] **Step 2: Document migration/setup**

Explain:
- applying `supabase/migrations`;
- RLS ownership;
- required existing Supabase auth env;
- optional `GEMINI_FEEDBACK_MODEL` if configurable;
- local tests/CI;
- no service role needed.

- [ ] **Step 3: Document session lifecycle, feedback security, analytics definitions, and limitations**

- [ ] **Step 4: Run a full React/Next.js quality review**

Check Server/Client boundaries, serializable props, focus/accessibility, mobile layout, unnecessary client data fetching.

- [ ] **Step 5: Run Superpowers code review over the complete diff relative to `feat/saas-home-auth`**

Explicitly inspect:
- RLS/grants/IDOR;
- cross-user session/message/feedback access;
- prompt injection;
- session duplication/finalization races;
- streak/timezone logic;
- misleading analytics;
- accessibility;
- Next.js 16 patterns;
- unnecessary complexity.

- [ ] **Step 6: Fix all Critical/Important findings with covering tests**

Use systematic debugging for failures and receiving-code-review discipline for every finding.

- [ ] **Step 7: Fresh full verification**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Where Supabase CLI/local DB is available, also apply migration to a non-production local/branch database and run the RLS SQL checks. If it is unavailable, report the integration gap exactly; do not claim RLS runtime verification.

- [ ] **Step 8: Verify GitHub CI on exact head**

Inspect workflow jobs/logs for the exact PR head SHA; fix failures before finalizing.

- [ ] **Step 9: Commit**

`ci: verify SaaS learning platform` and `docs: document learning platform architecture`

- [ ] **Step 10: Open the stacked PR**

Base: `feat/saas-home-auth`  
Head: `feat/saas-learning-platform`  
Title: `feat: add persistent learning sessions and progress dashboard`

PR body must explicitly state:

> This PR is stacked on PR #1 and intentionally targets `feat/saas-home-auth`. PR #1 should remain open until reviewed independently.

Leave both PRs open.
