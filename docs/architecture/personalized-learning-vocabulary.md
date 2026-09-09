# Personalized Learning and Vocabulary Architecture

## Scope

This milestone turns persisted Talk Tutor history into an active learning loop without adding a separate service, cache, queue, vector database, or agent framework.

The system extends the existing learner profile, learning session, transcript, feedback, and dashboard architecture with:

- deterministic progress aggregates;
- personalized practice configuration;
- curated and custom roleplay;
- Practice My Mistakes;
- learner-owned vocabulary;
- deterministic spaced repetition;
- on-demand personalized vocabulary examples.

## Progress definitions

### Practice minutes

Practice minutes include completed sessions that contain at least one finalized learner message. Abandoned sessions and completed sessions without learner speech are excluded. Duration uses the finalized server-side session duration.

Dashboard periods are calculated in the learner's saved IANA timezone:

- all-time minutes;
- current calendar week;
- current calendar month;
- previous calendar week;
- current local day.

A week-over-week comparison is shown only when the previous week contains practice.

### Streaks

A streak-qualifying session must:

1. be completed;
2. contain at least one finalized learner message;
3. last at least 60 seconds.

Multiple qualifying sessions on one local date count once. Current streak, longest streak, practiced-today state, and current-week active days use local date keys derived with the profile timezone.

### Common mistakes

Grammar corrections keep the stable categories already emitted by structured feedback:

- articles
- verb tense
- prepositions
- word order
- pluralization
- vocabulary misuse
- subject-verb agreement
- other

The dashboard shows total correction count and affected-session count. A direction label is shown only when both the latest rolling seven-day window and the preceding seven-day window contain at least two corrections for the category:

- fewer recent corrections: Improving
- equal count: Stable
- more recent corrections: Needs practice

Otherwise the UI says more data is needed.

### Skill trend

Talk Tutor does not invent a proficiency percentage.

The existing transcript-derived fluency coaching score uses the stable feedback rubric documented in the prior milestone. A historical trend is not displayed until at least three scored sessions exist. The UI shows the actual scored-session sequence and the point difference between the first and latest available score.

It remains a coaching signal, not an acoustic measurement, standardized examination score, or scientific proficiency grade.

## Personalized practice

A session has one validated practice configuration:

- mode: conversation, roleplay, mistakes, custom;
- topic;
- optional scenario and roles;
- correction frequency: minimal, balanced, frequent;
- conversation difficulty: easy, normal, challenging;
- up to three targeted grammar categories.

Correction frequency and difficulty defaults live on the learner profile. The Tutor controls are per-session overrides; changing them in the Tutor does not silently replace the saved profile default.

Practice metadata is persisted with each learning session so history and later analytics can identify what was intentionally targeted.

### Custom topics and roleplay

Topics are bounded free-form text with curated suggestions. The roleplay library is deliberately small and code-owned. Custom roleplay text and roles are length limited.

Gemini Live receives a fixed privileged tutoring policy plus a JSON block explicitly marked as untrusted practice data. User topics, custom scenarios, roles, and historical mistake categories are never treated as system policy.

### Practice My Mistakes

The pipeline is deterministic:

```text
structured historical corrections
        ↓
count + recency + affected sessions
        ↓
select up to three target categories
        ↓
safe practice configuration
        ↓
Gemini Live creates natural opportunities
        ↓
session persists targeted categories
        ↓
normal transcript + feedback pipeline
```

Regular conversation sessions do not inherit the target categories merely because recommendations are available.

## Vocabulary model

Migration:

```text
supabase/migrations/20260909090000_personalized_learning_vocabulary.sql
```

### vocabulary_items

A vocabulary item belongs directly to the learner, not to the source session. A nullable source-session reference uses same-owner composite foreign-key enforcement and becomes null if the session is deleted.

Deduplication key:

```text
(user_id, language, normalized_term)
```

Normalization is Unicode NFKC, trimmed/collapsed whitespace, and lowercase. PostgreSQL checks that the stored normalized term matches the source term.

Vocabulary states:

- learning: default and normal review state;
- strong: repetition count >= 5 and interval >= 21 days.

Strong is a review-state definition, not a claim of permanent mastery.

### vocabulary_reviews

Review history records:

- owned vocabulary item;
- rating;
- previous interval;
- resulting interval;
- review time.

A composite foreign key prevents a review from naming one learner as owner while referencing another learner's card.

## Spaced repetition

V1 uses a simplified SM-2 schedule.

New cards start with:

- ease 2.50;
- repetitions 0;
- interval 0;
- due immediately.

Ratings:

- Again: reset repetitions, 1-day interval, ease -0.20.
- Hard: repetitions +1, interval approximately previous × 1.2, ease -0.15.
- Good: first 1 day, second 3 days, then previous interval × ease.
- Easy: first 3 days, second 7 days, then previous interval × ease × 1.3, ease +0.15.

Ease is clamped to 1.30–3.00 and interval to 1–3650 days.

The browser never supplies authoritative review state. The PostgreSQL review RPC accepts only the owned item ID and rating, locks the item, computes the new schedule, appends review history, updates the card, and returns the resulting state atomically.

The TypeScript scheduling module mirrors the same rules and is tested with fixed clocks for deterministic domain verification.

## Vocabulary UX

`/vocabulary` shows real saved, due, learning, and strong counts plus saved terms.

`/vocabulary/review` fetches currently due cards in one indexed query. A card must be explicitly revealed before grading. Keyboard shortcuts are:

- Space / Enter: reveal
- 1: Again
- 2: Hard
- 3: Good
- 4: Easy

The same actions are full-size semantic buttons for touch users.

Session feedback exposes idempotent Save word actions.

## Personalized examples

Personalized vocabulary examples are generated only on explicit request and persisted on the vocabulary item. Page rendering never triggers an AI request.

Inputs can include one recent owned grammar correction, but all source context and mistake text is isolated in an untrusted JSON data block. Gemini structured output is parsed and locally validated before persistence. If generation fails, the base vocabulary card remains usable.

The implementation reuses `GEMINI_FEEDBACK_MODEL` (default `gemini-2.5-flash`) rather than adding a second required model setting.

## Query and cost boundaries

Deterministic database/business logic handles:

- counts;
- durations;
- streaks;
- mistake frequency;
- due cards;
- spaced repetition;
- recommendations;
- vocabulary growth.

AI remains limited to:

- normal post-session structured feedback;
- explicit personalized vocabulary-example generation;
- the existing real-time Gemini Live tutor.

The dashboard does not issue one model call per metric or recommendation.
