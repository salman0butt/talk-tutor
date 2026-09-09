# Personalized Learning, Progress & Vocabulary Review Design

**Date:** 2026-09-09  
**Base:** `main@c1f7048e3ff82bd3b5073b078583f63fe89b4e26`  
**Branch:** `feat/personalized-learning-vocabulary`

## Goal

Turn Talk Tutor's persisted conversation history into an active personalized learning loop: measure real progress, recommend the next useful practice, configure real tutor behavior, and convert discovered vocabulary into a deterministic spaced-repetition review system.

## Existing foundation

This milestone extends, rather than replaces:

- Supabase Auth with HttpOnly access/refresh cookies.
- `profiles` for learner defaults.
- `learning_sessions`, `session_messages`, and `session_feedback`.
- RLS and authenticated-user PostgREST access.
- Finalized-transcript session persistence.
- Structured grammar corrections, better sentences, vocabulary extraction, fluency coaching, history, and dashboard.
- Gemini Live for the real-time tutor and Gemini structured generation for post-session feedback.

No service-role key is introduced.

## Architecture

### 1. Progress domain

Progress remains deterministic and is calculated from completed, persisted learning data.

A practiced session is any completed session with at least one learner message. A streak-qualifying session additionally requires at least 60 seconds. Multiple sessions on one local calendar day count once for streak activity.

The enhanced dashboard RPC returns compact aggregates needed for one server render:

- total practiced minutes
- current-week and current-month minutes
- previous-week minutes
- completed sessions
- current and longest streak inputs
- current-week activity days
- correction-category counts with affected-session counts and recent/previous comparison windows
- fluency score series
- vocabulary saved/learning/strong counts
- new vocabulary this week
- due vocabulary count
- vocabulary cumulative growth series
- recent completed sessions
- recent languages

Trend labels are only shown when the sample is defensible. Common-mistake trend requires at least two corrections in both the current and previous comparison windows. Skill trend requires at least three scored sessions; otherwise the UI explains how to unlock it.

The UI never manufactures percentages. Fluency remains explicitly labeled a text-derived coaching score.

### 2. Practice configuration

Practice configuration is one typed object:

```ts
type PracticeConfiguration = {
  practiceMode: "conversation" | "roleplay" | "mistakes" | "custom";
  topic: string;
  scenarioId?: string;
  customScenario?: string;
  learnerRole?: string;
  tutorRole?: string;
  correctionFrequency: "minimal" | "balanced" | "frequent";
  difficulty: "easy" | "normal" | "challenging";
  targetMistakeCategories: GrammarCategory[];
}
```

Persistent defaults live on `profiles`:

- `correction_frequency`
- `conversation_difficulty`

Session-specific intent lives on `learning_sessions`:

- `practice_mode`
- `scenario_id`
- `custom_scenario`
- `learner_role`
- `tutor_role`
- `target_mistake_categories`

Topics remain session data. Free-form topics are allowed after validation; the prior closed-list restriction is removed. Input is normalized, bounded, and treated as untrusted data.

### 3. Roleplay

A small curated scenario library is code-owned, versioned, and inexpensive. It covers everyday, travel, and professional situations. Custom scenarios are bounded text and never interpreted as privileged instructions.

Roleplay configuration participates in normal persistence, feedback, history, and analytics because it uses the same session lifecycle.

### 4. Practice My Mistakes

Historical structured corrections are aggregated by category using count + recency. The top target categories are selected deterministically, with a maximum of three categories.

Entry points:

- Dashboard common mistakes → Practice these
- Tutor practice mode → My mistakes
- Session feedback → Practice this category

The selected categories are persisted on the new session. Tutor instructions create conversational opportunities that naturally exercise those structures. No additional AI request is needed to choose targets.

### 5. Safe Gemini Live prompt construction

Privileged policy and untrusted learner data are kept conceptually separate in the generated instruction.

The system prompt contains fixed Talk Tutor rules first, followed by explicitly delimited data sections for:

- topic
- custom scenario
- learner/tutor roles
- target mistake categories

Each section says the content is data, not instructions. Strings are normalized, length-limited, and delimiter-like control text is escaped/neutralized before prompt construction.

Correction frequency changes real behavior:

- minimal: correct only blocking/recurring high-value errors
- balanced: correct significant errors without interrupting each turn
- frequent: provide more immediate coaching, while preserving conversation flow

Difficulty changes lexical complexity, sentence length, idiomatic density, scaffolding, and prompt complexity. No unsupported audio-speed control is claimed.

### 6. Vocabulary persistence

Two tables are added.

#### `vocabulary_items`

Learner-owned durable item, independent from session deletion:

- id
- user_id
- term
- normalized_term
- language
- meaning
- part_of_speech nullable
- example_sentence nullable
- personalized_example nullable
- personalized_explanation nullable
- personalized_example_mistake_category nullable
- source_session_id nullable, `ON DELETE SET NULL`
- source_context nullable
- status: `learning | strong`
- ease_factor
- interval_days
- repetition_count
- next_review_at
- last_reviewed_at
- created_at / updated_at

Unique ownership key: `(user_id, language, normalized_term)`.

#### `vocabulary_reviews`

Append-only review history:

- id
- vocabulary_item_id
- user_id
- rating: `again | hard | good | easy`
- previous_interval_days
- next_interval_days
- reviewed_at

Composite FK `(vocabulary_item_id, user_id)` prevents cross-owner review insertion.

Both tables have RLS. Anonymous access is revoked.

### 7. Saving vocabulary

Words may be saved from session feedback and vocabulary pages.

Save is idempotent by normalized term + language. Existing saved words are not duplicated; new source context may fill missing metadata but does not reset spaced-repetition progress.

The source session is optional and uses `SET NULL` on deletion so review progress survives session cleanup.

### 8. Spaced repetition

V1 uses simplified SM-2 with deterministic grade mappings.

New cards:

- ease factor 2.50
- repetitions 0
- interval 0
- due immediately

Ratings:

- Again: repetitions 0, interval 1 day, ease -0.20, status learning
- Hard: repetitions +1, interval `max(1, round(previous * 1.2))`, ease -0.15
- Good:
  - first success → 1 day
  - second success → 3 days
  - later → `round(previous * ease)`
- Easy:
  - first success → 3 days
  - second success → 7 days
  - later → `round(previous * ease * 1.3)`
  - ease +0.15

Ease is clamped to 1.30–3.00. Intervals are at least one day and capped at 3650 days.

`strong` means repetition count >= 5 and interval >= 21 days. This is a product state, not a claim of permanent mastery.

Scheduling is timestamp-based from the supplied review clock. Tests use fixed clocks.

### 9. Vocabulary routes and UX

Authenticated navigation becomes:

- Dashboard
- Practice
- History
- Vocabulary
- Profile

`/vocabulary` is server-rendered and shows:

- due now
- saved count
- learning count
- strong count
- recently saved items
- next due time if nothing is due

`/vocabulary/review` starts a due-card queue.

Flashcards require explicit reveal before grading. Keyboard shortcuts:

- Space / Enter → reveal
- 1 → Again
- 2 → Hard
- 3 → Good
- 4 → Easy

Buttons remain touch friendly and focus-visible. Reduced motion is respected by avoiding mandatory flip animation.

### 10. Personalized examples

Personalized examples are optional, on-demand, and persisted. They are not generated on page load.

Input:

- term
- meaning
- learner language/level
- one recent owned grammar mistake category + example correction context when available

Gemini returns structured JSON:

```ts
type VocabularyExample = {
  sentence: string;
  explanation?: string;
  targetMistakeCategory?: GrammarCategory;
}
```

The system instruction declares all supplied learner/session text untrusted. Output is schema-constrained and locally validated. Failure leaves the base vocabulary card usable.

### 11. Recommendations

Recommendations are deterministic and ordered by immediate value:

1. due vocabulary review
2. recurring mistake practice
3. daily practice target gap
4. roleplay aligned with learning goal
5. generic conversation

No agent or ML recommendation system is introduced.

### 12. Database/RPC strategy

A new migration extends the existing schema and replaces `get_learning_dashboard()` with an expanded result. It also adds vocabulary RPCs that derive `auth.uid()`:

- `save_vocabulary_item(...)`
- `review_vocabulary_item(...)`
- `get_vocabulary_overview()`

Review scheduling arithmetic is implemented in TypeScript and validated server-side, while the review write is atomic through an owner-scoped RPC accepting the computed next state. The database validates allowed ratings and interval/ease bounds.

Session creation RPC is extended with practice metadata while still deriving ownership from `auth.uid()`.

### 13. Security

Mandatory controls:

- RLS on every learner-owned table.
- No client user IDs.
- Composite owner foreign keys for vocabulary reviews.
- `source_session_id` may only reference a session owned by the same user through a composite FK.
- All RPCs are SECURITY INVOKER.
- Anonymous table/RPC access revoked.
- Custom topic/scenario strings bounded at both API and database layers.
- Prompt data is delimited and explicitly non-authoritative.
- AI output is locally validated before persistence.

### 14. Error and empty states

- New dashboard: explains that three scored sessions unlock skill trends.
- No mistakes: encourages natural practice instead of showing a broken zero state.
- No vocabulary: explains save-from-feedback flow.
- No due cards: shows next scheduled review when available.
- AI example failure: existing meaning/example stays usable and retryable.
- Persistence failures: recoverable route-level feedback without falsifying progress.

### 15. Performance

One dashboard RPC and one vocabulary overview RPC supply aggregate pages. No per-card model calls. Due cards are fetched in one indexed query. Review writes are one atomic RPC each.

Indexes cover:

- completed session user/date
- session practice targets
- vocabulary user/language/normalized term
- vocabulary user/next_review_at
- vocabulary user/status
- review item/reviewed_at

No Redis, queues, vector database, or materialized views.

### 16. Testing

Deterministic unit tests cover:

- progress minutes and period comparisons
- current/longest streak
- week activity
- mistake trends and insufficient samples
- skill trend sample thresholds
- vocabulary normalization/deduplication/growth
- practice configuration validation
- safe prompt construction
- target-mistake selection
- recommendation priority
- all spaced-repetition ratings, interval/ease transitions, failure after success, fixed-clock dates, invalid grades
- personalized example validation

PostgreSQL CI covers migration parsing, policies, grants, composite ownership, two-user isolation, duplicate vocabulary prevention, review ownership, and auth-derived session metadata.

## Known V1 boundaries

- No acoustic pronunciation scoring.
- No automatic speech-speed control.
- No AI scheduling.
- No social vocabulary decks.
- No semantic/vector vocabulary taxonomy.
- No automatic background personalized-example generation.
- No claim that `strong` equals permanent mastery.
