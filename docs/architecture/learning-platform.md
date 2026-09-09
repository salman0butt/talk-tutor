# Learning Platform Architecture

## Scope

This document describes the persistent learning layer stacked on the Talk Tutor SaaS authentication branch.

The public homepage and authentication flows remain owned by PR #1. This layer adds authenticated learner state, durable practice sessions, post-session feedback, session review, and progress analytics.

## Boundaries

### Authentication

Supabase Auth remains unchanged from the stacked base.

- access token: HttpOnly cookie
- refresh token: HttpOnly cookie
- session validation: server-side Supabase Auth REST request
- refresh: Next.js `proxy.ts`

The learning platform obtains the current user and access token only on the server.

### Persistence

Server code calls Supabase PostgREST with the authenticated user's JWT.

```text
Browser
  ↓ authenticated request
Next.js route / Server Component
  ↓ HttpOnly session lookup
LearningRepository
  ↓ Bearer <user access token>
Supabase PostgREST
  ↓
Postgres RLS
```

There is no service-role bypass.

## Data model

### profiles

One row per `auth.users.id`.

Stores:

- preferred language
- proficiency level
- tutor voice
- learning goal
- daily target
- IANA timezone

Profiles are created lazily using the existing tutor defaults.

### learning_sessions

One row per conversation that reached a finalized learner utterance.

Important state:

- language / proficiency / topic / voice snapshot
- started and ended timestamps
- server-calculated duration
- `active | completed | abandoned`
- feedback lifecycle state

### session_messages

Final transcript turns.

Each message carries:

- owner id
- session id
- `user | assistant`
- deterministic sequence
- text
- occurrence timestamp

The composite foreign key `(session_id, user_id)` prevents attaching a child row to another learner's session.

### session_feedback

One structured feedback object per session.

Stores arrays/objects for:

- grammar corrections
- better sentences
- vocabulary
- fluency coaching
- next steps

Pronunciation notes are currently persisted as an empty array because no supported acoustic evidence is stored.

## Tutor persistence flow

The existing Zustand audio/transcript store remains the realtime source of UI state.

```text
User clicks connect
  ↓
fresh LearningSessionRecorder created
  ↓
Gemini Live starts
  ↓
partial transcription callback
  └── update Zustand transcript only

finalized transcription callback
  ↓
update Zustand transcript
  ↓
LearningSessionRecorder.recordFinalTurn()
```

The recorder owns a serialized promise chain so session creation, message append, and finalization cannot race.

### Empty-session prevention

The recorder buffers finalized turns in memory until there is at least one finalized user turn.

Only then does `start_learning_session` create the database session and initial messages atomically.

Opening `/tutor`, connecting, or receiving an assistant-only greeting creates no durable session.

### Disconnect handling

Explicit disconnect and the LiveManager close/error callback both call the same recorder finalization method.

Finalization is idempotent at both layers:

- recorder has a finalization guard;
- PostgreSQL only transitions an active session once.

## Feedback lifecycle

```text
finalize session
  ↓
feedback_status=pending
  ↓
Next.js after()
  ↓
FeedbackService
  ↓
atomic pending/failed → processing claim
  ↓
load persisted transcript
  ↓
system instruction + bounded untrusted transcript payload
  ↓
Gemini JSON schema
  ↓
local validation
  ↓
save structured feedback
  ↓
feedback_status=completed
```

If generation or validation fails, only `feedback_status` changes to `failed`.

The learning session stays completed and its transcript stays reviewable.

A retry from session history follows the same atomic claim path.

## Progress aggregation

Postgres performs the inexpensive historical aggregation in `get_learning_dashboard()`.

It returns:

- total completed minutes
- completed sessions
- current-week session count
- seven-day practice rows
- distinct normalized vocabulary count
- common grammar category counts
- recent languages
- recent feedback scores
- meaningful local practice dates

TypeScript then performs deterministic presentation/domain calculations:

- practice streak
- seven-day gap filling
- feedback score trend
- defensive RPC normalization

## Streak definition

A practice date exists only for sessions that are:

- completed;
- at least 60 seconds;
- contain at least one finalized user message.

Session dates are converted using `profiles.timezone` inside PostgreSQL.

The TypeScript streak algorithm receives those already-local date keys and therefore does not accidentally reinterpret them as UTC.

## Feedback score definition

The 0–100 fluency value is intentionally a coaching metric, not a proficiency certification.

Stable rubric:

- sentence construction: 40%
- vocabulary appropriateness/range: 30%
- conversational continuity visible in transcript: 30%

The dashboard only displays a trend when actual structured feedback scores exist.

## Performance

V1 intentionally avoids queues, Redis, materialized views, and duplicate analytics tables.

Indexes cover:

- sessions by learner/end time;
- sessions by learner/status;
- messages by learner/session/sequence;
- feedback by learner/create time.

Dashboard history aggregation is one security-invoker RPC plus a small recent-session query.

## V1 limitations

- no persisted audio;
- no audio replay;
- no acoustic pronunciation scoring;
- no spaced repetition;
- no background job system;
- no standardized language proficiency score;
- no cross-user/social features.


## Personalized learning extension

The next schema extension is documented in `docs/architecture/personalized-learning-vocabulary.md`. It deliberately reuses this authentication, session, transcript, feedback, PostgREST, and RLS architecture rather than creating parallel learner-history tables.

The dashboard RPC now includes period practice totals, vocabulary state counts, mistake comparison windows, and vocabulary growth. Personalized practice metadata is stored on the same `learning_sessions` row as the conversation it configured.
