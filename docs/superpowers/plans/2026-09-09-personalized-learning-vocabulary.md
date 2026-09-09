# Personalized Learning, Progress & Vocabulary Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Talk Tutor into a history-driven personalized learning system with defensible progress analytics, personalized practice modes, and deterministic vocabulary review.

**Architecture:** Extend the existing profile/session/feedback model. Add pure deterministic domain modules for progress, practice configuration, recommendations, and spaced repetition; add two RLS-protected vocabulary tables; feed one validated practice configuration into the existing Gemini Live session path; expose compact server-side aggregate RPCs for dashboard and vocabulary pages.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Zustand, Gemini Live / Google GenAI, Supabase Auth, PostgREST, PostgreSQL 17, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-personalized-learning-vocabulary-design.md`

## Global Constraints

- Base branch is `main` at `c1f7048e3ff82bd3b5073b078583f63fe89b4e26`.
- Reuse `profiles`, `learning_sessions`, `session_messages`, and `session_feedback`.
- Never accept an authoritative client user ID.
- RLS is mandatory for new learner-owned tables.
- No service-role key.
- No fabricated metrics or unsupported audio-speed claims.
- Custom topics/scenarios and historical transcript content are untrusted prompt data.
- Deterministic business logic is implemented test-first.
- No Redis, queues, vector database, event sourcing, or agent framework.

---

### Task 1: Establish CI and RED domain tests

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Create: `tests/learning/progress-v2.test.mjs`
- Create: `tests/learning/practice-config.test.mjs`
- Create: `tests/learning/spaced-repetition.test.mjs`
- Create: `tests/learning/recommendations.test.mjs`

**Interfaces:**
- Produces desired APIs for Tasks 2–4.

- [ ] Write tests importing planned functions from `lib/learning/progress.ts`, `practice.ts`, `spaced-repetition.ts`, and `recommendations.ts`.
- [ ] Cover fixed-clock streaks, longest streak, period minutes, mistake trends, insufficient samples, practice config sanitization, target mistake selection, recommendation priority, and every review rating.
- [ ] Update test script to continue matching all `tests/learning/*.test.mjs`.
- [ ] Update CI push trigger to `feat/personalized-learning-vocabulary`.
- [ ] Push test-only commit and verify GitHub Actions fails because the new production modules do not exist. Record that RED evidence.

### Task 2: Implement progress domain

**Files:**
- Create: `lib/learning/progress.ts`
- Modify: `lib/learning/types.ts`

**Interfaces:**
- Produces `calculatePracticeMinutes`, `calculateStreakSummary`, `aggregateMistakeTrends`, `calculateSkillTrend`, `calculateVocabularyGrowth`.

- [ ] Implement minimal pure functions required by RED tests.
- [ ] Preserve 60-second streak qualification and local date-key semantics.
- [ ] Require sufficient samples before trend labels.
- [ ] Push and verify focused unit tests become green.

### Task 3: Implement practice configuration and prompt safety

**Files:**
- Create: `lib/learning/practice.ts`
- Modify: `lib/learning/types.ts`
- Modify: `lib/learning/validation.ts`
- Modify: `types.ts`
- Modify: `services/liveManager.ts`

**Interfaces:**
- Produces `PracticeConfiguration`, `parsePracticeConfiguration`, `selectTargetMistakes`, `buildTutorSystemInstruction`.

- [ ] Implement bounded custom topics/scenarios and enum validation.
- [ ] Implement curated scenario library.
- [ ] Implement deterministic mistake target selection.
- [ ] Replace direct interpolation prompt with a fixed-policy builder and delimited untrusted data.
- [ ] Map correction frequency and difficulty to real tutor instruction behavior.
- [ ] Verify practice tests green.

### Task 4: Implement deterministic recommendations

**Files:**
- Create: `lib/learning/recommendations.ts`
- Modify: `lib/learning/types.ts`

**Interfaces:**
- Produces `buildRecommendedPractice(input)`.

- [ ] Prioritize due vocabulary, recurring mistakes, target gap, learning-goal roleplay, then conversation.
- [ ] Keep output explainable with source counts.
- [ ] Verify recommendation tests green.

### Task 5: Extend database for practice metadata and vocabulary

**Files:**
- Create: `supabase/migrations/20260909090000_personalized_learning_vocabulary.sql`
- Create: `supabase/tests/personalized_learning_schema.sql`
- Create: `supabase/tests/personalized_learning_rls_runtime.sql`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Adds profile practice defaults, session intent columns, `vocabulary_items`, `vocabulary_reviews`, expanded dashboard RPC, vocabulary overview RPC, save/review RPCs.

- [ ] Extend profiles with correction frequency and difficulty constraints/defaults.
- [ ] Extend sessions with practice mode, roles/scenario, and target categories.
- [ ] Add vocabulary tables, indexes, grants, RLS, composite owner FKs.
- [ ] Extend `start_learning_session` signature and dashboard aggregate.
- [ ] Add owner-derived vocabulary RPCs.
- [ ] Update CI to apply both migrations and both new SQL assertion files.
- [ ] Verify two-user runtime attempts cannot read/write cross-owner vocabulary or practice metadata.

### Task 6: Extend server repository and profile API

**Files:**
- Modify: `lib/learning/repository.ts`
- Modify: `lib/learning/server.ts`
- Modify: `lib/learning/session-api.ts`
- Modify: `lib/learning/session-recorder.ts`
- Modify: `app/api/learning/profile/route.ts`
- Create: `lib/learning/vocabulary.ts`

**Interfaces:**
- Repository maps new profile/session fields and vocabulary rows.
- Recorder persists full `PracticeConfiguration`.

- [ ] Map profile practice defaults.
- [ ] Pass session metadata through recorder → session API → start RPC.
- [ ] Add vocabulary list/save/remove/review repository methods.
- [ ] Normalize terms before save and treat duplicate save as idempotent.
- [ ] Add server view models for dashboard/vocabulary/review.

### Task 7: Add personalized example pipeline

**Files:**
- Create: `lib/learning/vocabulary-example/service.ts`
- Create: `lib/learning/vocabulary-example/provider.ts`
- Create: `tests/learning/vocabulary-example.test.mjs`
- Create: `app/api/learning/vocabulary/[itemId]/example/route.ts`

**Interfaces:**
- Produces validated `VocabularyExample` and persisted example fields.

- [ ] Write RED tests for schema validation, prompt isolation, no duplicate generation when already persisted, and provider failure.
- [ ] Use Gemini structured JSON with fixed system instruction.
- [ ] Include at most one recent owned mistake context.
- [ ] Persist result once; page loads never trigger generation.

### Task 8: Build vocabulary APIs

**Files:**
- Create: `app/api/learning/vocabulary/route.ts`
- Create: `app/api/learning/vocabulary/[itemId]/route.ts`
- Create: `app/api/learning/vocabulary/[itemId]/review/route.ts`

**Interfaces:**
- POST save word, DELETE owned word, POST deterministic review grade.

- [ ] Validate UUIDs and bodies before repository work.
- [ ] Review route uses fixed server clock and `scheduleVocabularyReview`.
- [ ] Do not expose cross-owner existence.

### Task 9: Build vocabulary library and flashcard UI

**Files:**
- Create: `app/(learn)/vocabulary/page.tsx`
- Create: `app/(learn)/vocabulary/loading.tsx`
- Create: `app/(learn)/vocabulary/review/page.tsx`
- Create: `components/vocabulary/vocabulary-overview.tsx`
- Create: `components/vocabulary/vocabulary-item-card.tsx`
- Create: `components/vocabulary/flashcard-review.tsx`
- Create: `components/vocabulary/save-word-button.tsx`
- Create: `components/vocabulary/personalized-example-button.tsx`
- Modify: `components/history/session-feedback.tsx`

**Interfaces:**
- Save vocabulary directly from session feedback.
- Review UI grades only after reveal.

- [ ] Add empty, due, and all-caught-up states.
- [ ] Add touch-friendly four-grade controls and keyboard shortcuts.
- [ ] Include source context, persisted examples, next-review information.
- [ ] Keep base card usable when AI example generation fails.

### Task 10: Upgrade navigation and profile settings

**Files:**
- Modify: `components/app-nav.tsx`
- Modify: `components/navbar.tsx`
- Modify: `components/profile/profile-form.tsx`
- Modify: `components/learning/profile-hydrator.tsx`

**Interfaces:**
- Navigation includes Vocabulary.
- Profile exposes correction frequency and difficulty defaults.

- [ ] Persist new profile defaults through existing profile endpoint.
- [ ] Hydrate tutor store with all defaults.

### Task 11: Build personalized tutor configuration UI

**Files:**
- Modify: `store/useAudioStore.ts`
- Modify: `components/left-sidebar.tsx`
- Create: `components/practice/scenario-picker.tsx`
- Create: `components/practice/mistake-targets.tsx`
- Modify: `app/tutor/page.tsx`

**Interfaces:**
- Store holds one `PracticeConfiguration` and sends it to LiveManager and recorder.

- [ ] Add conversation/roleplay/mistakes/custom modes.
- [ ] Add predefined + free-form topics.
- [ ] Add roleplay roles/custom scenario.
- [ ] Add correction frequency and difficulty.
- [ ] Load recommended mistake categories server-side and hydrate them.
- [ ] Disable unsafe configuration mutation during active connection.
- [ ] Ensure persisted session records targets and mode.

### Task 12: Upgrade dashboard

**Files:**
- Modify: `app/(learn)/dashboard/page.tsx`
- Modify: `components/dashboard/common-mistakes.tsx`
- Modify: `components/dashboard/skill-progress.tsx`
- Modify: `components/dashboard/weekly-practice.tsx`
- Create: `components/dashboard/vocabulary-growth.tsx`
- Create: `components/dashboard/recommended-practice.tsx`

**Interfaces:**
- Consumes expanded dashboard snapshot and deterministic recommendation.

- [ ] Show total/week/month practice and reliable previous-week comparison.
- [ ] Show current + longest streak, today, active days, goal progress.
- [ ] Show mistake affected sessions and trend only with sufficient data.
- [ ] Show skill trend only after enough scored sessions.
- [ ] Show saved/learning/strong/new/due vocabulary.
- [ ] Add Practice My Mistakes and Review Vocabulary CTAs.
- [ ] Provide text summaries for all visual charts.

### Task 13: Documentation and integration hardening

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/learning-platform.md`
- Modify: `docs/security/learning-platform.md`
- Create: `docs/architecture/personalized-learning-vocabulary.md`

- [ ] Document metric definitions, trend sample rules, practice settings, prompt boundaries, vocabulary states, simplified SM-2, RLS, AI cost boundaries, migrations, and deployment requirements.
- [ ] Verify no docs claim unsupported pronunciation/audio-speed/mastery behavior.

### Task 14: Review and final verification

**Files:** full branch diff.

- [ ] Run fresh exact-head GitHub CI: install, lint, typecheck, all Node tests, both migrations + SQL security/runtime tests, production build.
- [ ] Review full diff for IDOR, RLS, prompt injection, duplicate vocabulary, interval math, timezone boundaries, fake analytics, client/server query count, mobile/accessibility issues.
- [ ] Fix all Critical and Important findings with regression tests.
- [ ] Re-run exact-head verification.
- [ ] Create PR `feat: add personalized practice and vocabulary learning` targeting `main`.
- [ ] Leave the PR open; do not merge.
