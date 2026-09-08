# Talk Tutor Persistent Learning Platform Design

**Date:** 2026-09-09  
**Base branch:** `feat/saas-home-auth`  
**Base SHA:** `0e902d709db3a9c8b33617156e2e66df7d379b0b`

## Goal

Transform Talk Tutor from an authenticated single-session voice tutor into a persistent learning SaaS with learner preferences, durable session history, structured post-session feedback, and defensible progress analytics.

## Repository reality

The stacked base already provides Next.js 16.1.6, React 19, Tailwind 4, Zustand for live audio state, direct Supabase Auth REST calls with HttpOnly access/refresh cookies, a protected `/tutor` route, and Gemini Live audio/transcription. The realtime transcript is stored in `useAudioStore` as partial/final `user | model` items. There is no database schema, migration directory, test runner, or GitHub Actions workflow yet.

The existing `feat/saas-learning-platform` branch is identical to the PR #1 head and therefore safe to reuse.

## Architecture decision

### Chosen approach: authenticated PostgREST + RLS

Keep the existing authentication architecture and add a small server-only PostgREST client that forwards the authenticated user's Supabase access token. All profile/session/feedback tables have RLS enabled and explicit authenticated-role grants/policies. Application code never accepts a client-supplied owner id.

Why:
- preserves PR #1 instead of rewriting auth;
- requires no service-role key;
- keeps authorization inside Postgres as defense in depth;
- avoids adding `@supabase/supabase-js` solely for CRUD;
- keeps server routes easy to test through pure validation/aggregation helpers.

### Rejected alternatives

1. **Add Supabase SSR/client packages and refactor auth.** Cleaner long-term SDK ergonomics, but it unnecessarily rewrites working stacked-PR auth and expands this milestone.
2. **Use a service-role key for persistence.** Simpler server writes, but bypasses RLS and increases blast radius. Not justified for user-owned CRUD.
3. **Persist every live transcription delta.** Durable but write-heavy and race-prone. Finalized turn persistence is sufficient because Gemini already marks turn completion.

## Data model

### `profiles`

One row per authenticated user.

- `id uuid primary key references auth.users(id) on delete cascade`
- preferred language
- proficiency level
- preferred assistant voice
- learning goal
- daily practice target minutes
- IANA timezone
- created/updated timestamps

The profile is created lazily on the first authenticated profile read if it does not exist. Defaults match the existing tutor defaults. The server derives the id from the validated auth session.

### `learning_sessions`

- UUID id
- user id
- language
- proficiency level
- topic/scenario
- assistant voice
- started/ended timestamps
- duration seconds
- status: `active | completed | abandoned`
- feedback status: `not_requested | pending | processing | completed | failed`
- created/updated timestamps

A composite unique key on `(id, user_id)` supports owner-safe child foreign keys.

### `session_messages`

Structured final transcript messages only.

- UUID id
- session id + user id composite FK
- role: `user | assistant`
- sequence integer, unique per session
- text
- occurred_at
- created_at

Partial realtime tokens are UI-only and never persisted.

### `session_feedback`

One feedback record per session.

- session id + user id
- summary
- grammar corrections JSON array
- better sentence suggestions JSON array
- vocabulary JSON array
- fluency object
- pronunciation notes JSON array
- next steps JSON array
- timestamps

Grammar corrections include a simple category taxonomy:
`articles | verb_tense | prepositions | word_order | pluralization | vocabulary_misuse | agreement | other`.

## RLS and grants

Every public table:
- enables RLS;
- revokes all privileges from `anon`;
- grants only required CRUD to `authenticated`;
- uses explicit per-operation policies with `(select auth.uid()) = user_id`;
- uses both `USING` and `WITH CHECK` for updates;
- never relies on client filtering.

Child rows include `user_id` and a composite FK back to the owner/session pair, preventing a valid user from attaching rows to another user's session.

## Profile flow

1. Protected Tutor page reads the user's profile server-side.
2. Missing profile is inserted using authenticated PostgREST.
3. Initial preferences hydrate the Zustand store once.
4. Language/proficiency/voice setters update Zustand immediately.
5. Setters debounce persistence to `PUT /api/learning/profile`.
6. Profile/settings UI exposes goal, daily target, timezone, and tutor defaults.

Topic remains session-specific rather than a profile preference.

## Live session lifecycle

```text
connect
  -> Gemini connection established
  -> no DB session yet
  -> receive partial transcript (UI only)
  -> first finalized USER turn
  -> POST /api/learning/sessions with config + initial message
  -> later finalized turns POST as single turn messages
  -> disconnect/close
  -> PATCH session finalize
  -> if meaningful, trigger feedback generation
  -> history/dashboard read persisted result
```

### Empty-session rule

Opening Tutor or connecting without a finalized user utterance creates no learning session.

### Meaningful-session rule

For streak/progress purposes a session is meaningful when:
- status is completed;
- duration is at least 60 seconds;
- at least one persisted user message exists.

A shorter non-empty session can still appear in history, but does not count as a practice day/streak.

### Unexpected disconnects

The store owns a small session recorder state (`sessionId`, start time, message sequence, finalization guard). Both explicit disconnect and LiveManager close/error state attempt idempotent finalization. The API accepts repeated finalization safely.

## Feedback pipeline

Feedback generation is server-side only.

1. Finalization marks feedback `pending` for non-empty sessions.
2. `POST /api/learning/sessions/:id/feedback` verifies ownership through authenticated RLS.
3. The server loads the persisted structured transcript.
4. Transcript is serialized as data under explicit delimiters and the model is told it is untrusted conversation data, never instructions.
5. Gemini receives a JSON schema request.
6. The returned JSON is parsed and validated again with local deterministic validators.
7. Valid feedback is persisted and status becomes `completed`.
8. Provider/parse failure only sets feedback status `failed`; the session remains completed and reviewable.

No pronunciation observations are generated from text alone. For V1, `pronunciationNotes` is always an empty array unless a future evidence source is added.

Transcript input is length-limited before model submission.

## Stable coaching rubric

The feedback `fluency.score` is a coaching score from 0–100 using a fixed prompt rubric:
- sentence construction: 40%
- vocabulary appropriateness/range: 30%
- conversational continuity from transcript turns: 30%

It is explicitly not an acoustic pronunciation score or standardized exam score.

Dashboard trend uses recent feedback scores only when feedback exists.

## Progress analytics

Pure TypeScript aggregation functions calculate:
- current practice streak from meaningful completed sessions;
- total practice minutes;
- completed sessions;
- sessions in current local week;
- unique normalized vocabulary terms;
- common correction categories;
- recent languages;
- feedback score trend.

Vocabulary normalization lowercases, Unicode-normalizes, trims, and collapses whitespace. Identical normalized terms count once.

### Timezone strategy

`profiles.timezone` stores an IANA timezone string. Default is `UTC`; the Profile UI offers browser timezone detection. Streak/day boundaries use `Intl.DateTimeFormat` with that timezone, never server-local time.

## API surface

All routes are protected by the existing auth proxy plus handler-level authenticated-user checks.

- `GET/PUT /api/learning/profile`
- `POST /api/learning/sessions`
- `POST /api/learning/sessions/:id/messages`
- `PATCH /api/learning/sessions/:id`
- `POST /api/learning/sessions/:id/feedback`

Read-heavy history/dashboard pages use Server Components and server-only data helpers directly rather than calling their own HTTP APIs.

Malformed UUIDs are rejected before database access.

## UI information architecture

Authenticated global navigation:
- Dashboard
- Practice
- History
- Profile
- Logout

Routes:
- `/dashboard`: primary overview with real metrics, weekly practice visualization, coaching trend, common mistakes, vocabulary growth, recent sessions.
- `/history`: session cards and empty state.
- `/history/[sessionId]`: educational review with feedback cards and transcript.
- `/profile`: compact learner settings form.
- `/tutor`: existing focused realtime UI with profile hydration and session recorder integration.

No audio playback is shown because audio is not persisted.

## Error handling

- Profile persistence failure leaves local tutor selection usable and shows a non-blocking settings error when relevant.
- Session-create failure does not terminate Gemini practice; recorder retries creation on the next finalized turn.
- Message persistence failure is surfaced in recorder state and retried once on a later turn/finalize path.
- Feedback failure does not invalidate a completed session.
- Missing/foreign session detail returns not-found behavior rather than exposing ownership distinctions.
- Dashboard/history have empty and data-load failure states.

## Testing strategy

Use Node 22's built-in test runner with `--experimental-strip-types` against pure TypeScript modules, avoiding a new test dependency and lockfile churn.

Strict TDD applies to:
- profile input validation;
- session lifecycle decisions/duration;
- UUID validation;
- feedback schema validation;
- vocabulary normalization/deduplication;
- common-mistake aggregation;
- streak boundaries;
- progress aggregation;
- authorization request shaping.

Route/database integration that needs live Supabase is documented separately; CI validates TypeScript, lint, unit tests, and production build.

## CI

Add a GitHub Actions workflow using the committed pnpm lockfile:
- Node 22
- Corepack/pnpm
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Build receives placeholder non-secret environment values where static compilation requires them. No production secrets are committed.

## Known V1 limits

- No audio recording or replay.
- No pronunciation scoring from text transcripts.
- Feedback runs synchronously after finalization/request; no background queue.
- No flashcards/SRS.
- No materialized analytics tables.
- Supabase migration must be applied to the correct Talk Tutor project by the operator because the repository currently contains no unambiguous Supabase project ref.
