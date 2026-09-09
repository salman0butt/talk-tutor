# Learning Platform Security Model

## Primary rule

A learner must never be able to read or mutate another learner's profile, sessions, transcript, feedback, or progress data.

Authorization is enforced in PostgreSQL Row Level Security, not only in route handlers.

## Identity

Client requests never supply an authoritative owner id.

Server code obtains:

1. the authenticated Supabase user from the HttpOnly access token;
2. the same access token for PostgREST.

`LearningRepository` is constructed with that authenticated identity.

Mutation payloads containing a client `user_id` are ignored/overwritten by tested ownership helpers.

Session RPCs accept no user-id parameter and derive ownership from `auth.uid()`.

## RLS

RLS is enabled on:

- `profiles`
- `learning_sessions`
- `session_messages`
- `session_feedback`

The `anon` role has no learning-table privileges.

The `authenticated` role receives only the CRUD operations required by the application, and every operation is constrained by owner policies.

Update policies include both `USING` and `WITH CHECK`.

## Child-row ownership

`session_messages` and `session_feedback` carry `user_id` in addition to `session_id`.

Composite foreign keys target `learning_sessions(id, user_id)`.

This prevents a learner from supplying their own `user_id` while pointing a child row at someone else's session.

## Defense in depth

Repository reads include explicit owner filters even though RLS already enforces ownership.

This:

- reduces accidental broad reads;
- improves query selectivity;
- gives route-level intent visible in code.

Invalid session UUIDs are rejected before a persistence request is constructed.

Foreign and nonexistent session detail requests deliberately collapse into the same not-found UI.

## Database input integrity

Database constraints independently protect supported language, level, voice, status, durations, message roles/sequences, text lengths, and JSON container shapes.

A database trigger validates profile timezones against PostgreSQL's timezone catalog.

The session-start RPC caps the initial message array at 20 turns even if somebody calls PostgREST directly instead of using the application validator.

## Feedback prompt injection

Transcript text is fully untrusted.

The feedback system:

- reads a previously persisted owner-scoped transcript;
- limits newest turns and total input size;
- serializes transcript turns as JSON;
- sends immutable coaching/security policy through Gemini `systemInstruction`;
- sends transcript JSON only in the lower-priority content payload;
- wraps transcript content in explicit untrusted-data delimiters;
- explicitly instructs Gemini never to follow instructions in transcript content;
- requests structured JSON;
- parses the response;
- performs independent local runtime validation;
- never executes transcript/model content.

## Feedback concurrency

Feedback status is claimed with an owner-scoped conditional update:

```text
pending | failed
      ↓ atomic PATCH
processing
```

Only the request that successfully updates the row invokes Gemini.

This avoids duplicate automatic/manual model calls under normal Postgres row-update semantics.

## Pronunciation integrity

The current product persists transcripts, not audio evidence suitable for pronunciation analysis.

Therefore:

- the prompt tells Gemini not to provide pronunciation observations;
- runtime validation forces `pronunciationNotes` to an empty array;
- the UI states that the coaching score is text-based.

## Secrets

Server-only:

- `GEMINI_API_KEY`
- authenticated access token from HttpOnly cookie
- refresh token from HttpOnly cookie

Browser-visible configuration:

- Supabase project URL
- Supabase anon/publishable key

No service-role key is required by this design.

## CI security checks

GitHub Actions starts disposable PostgreSQL and:

1. creates minimal Supabase-compatible auth objects;
2. applies the migration;
3. checks RLS on every learning table;
4. checks expected policies;
5. confirms `anon` has no learning-data SELECT access;
6. confirms authenticated access grants exist;
7. confirms learning RPCs are `SECURITY INVOKER`;
8. confirms composite ownership foreign keys.

This is schema-level validation only.

A final deployment should still verify two real Supabase users against the correctly configured Talk Tutor project because CI cannot prove hosted Supabase Auth/PostgREST integration without project credentials.


## Personalized learning and vocabulary

The personalized-learning migration enables RLS on `vocabulary_items` and `vocabulary_reviews`, revokes anonymous table/RPC access, and uses `auth.uid()` as the ownership source.

A composite `(vocabulary_item_id, user_id)` foreign key prevents cross-owner review insertion. Source sessions use a same-owner composite foreign key so an owned vocabulary record cannot claim another learner's session as provenance.

Vocabulary review state is not accepted from the browser. The review RPC locks the current learner's item and computes ease, repetitions, interval, status, and timestamps in PostgreSQL from the rating.

Custom practice topics, scenarios, roles, historical corrections, source contexts, and transcripts are untrusted model inputs. Gemini Live and personalized-example prompts put these values in clearly marked data blocks beneath fixed system policy. Model output used for personalized examples is structured and validated locally before persistence.

CI applies both migrations to disposable PostgreSQL and runs two-user RLS/runtime assertions. This does not replace deployment verification against the actual Talk Tutor Supabase project.
