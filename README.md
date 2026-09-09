# Talk Tutor

Talk Tutor is a voice-first AI language-learning SaaS built with Next.js, React, Gemini Live, Supabase Auth, Postgres, and Row Level Security.

## Product capabilities

### Public and authentication

- Responsive SaaS landing page
- Email/password signup and sign in
- Email confirmation
- Forgot/reset password
- HttpOnly access and refresh cookies
- Protected Gemini ephemeral-token endpoint

### Persistent learning platform

- Authenticated learner profile
- Persistent language, proficiency, and tutor-voice preferences
- Learning goal, daily practice target, and IANA timezone
- Real-time Gemini voice conversation
- Structured finalized transcript persistence
- Session history and educational session review
- Structured post-session Gemini feedback
- Grammar corrections with stable mistake categories
- Better sentence suggestions
- Vocabulary extracted from conversations
- Text-derived fluency coaching summary and score
- Timezone-aware practice streak
- Weekly practice visualization
- Vocabulary growth and common-mistake analytics
- Premium authenticated dashboard
- Personalized conversation, roleplay, custom-topic, and Practice My Mistakes modes
- Persistent correction-frequency and conversation-difficulty defaults
- Learner-owned vocabulary library with save-from-feedback
- Deterministic simplified SM-2 flashcard review
- Due/learning/strong vocabulary states
- On-demand persisted personalized vocabulary examples
- Deterministic recommended-practice suggestions

Talk Tutor does **not** store audio recordings in this version. Session review is transcript-based, and the application does not claim pronunciation accuracy from text transcripts.

## Architecture

The application keeps the authentication model introduced in the SaaS auth layer: Supabase Auth REST endpoints issue sessions that are stored in secure HttpOnly cookies.

Persistent learner data is accessed server-side through Supabase PostgREST using the authenticated user's access token. A service-role key is not required. PostgreSQL Row Level Security remains the ownership boundary even if an application query is implemented incorrectly.

See:

- `docs/architecture/learning-platform.md`
- `docs/architecture/live-conversation.md`
- `docs/architecture/ai-quality-foundation.md`
- `docs/architecture/ai-guardrails-evals.md`
- `docs/security/learning-platform.md`
- `docs/superpowers/specs/2026-09-09-saas-learning-platform-design.md`

## Database schema

The learning-platform migration is:

```text
supabase/migrations/20260909000000_learning_platform.sql
```

It creates:

- `profiles`
- `learning_sessions`
- `session_messages`
- `session_feedback`
- `vocabulary_items`
- `vocabulary_reviews`

The prerequisite migration installs the persistent session platform. The personalized-learning migration is `supabase/migrations/20260909090000_personalized_learning_vocabulary.sql`; it extends profiles/sessions and adds vocabulary tables, indexes, RLS, and ownership-safe vocabulary/review RPCs.

Apply the migration to the **Talk Tutor Supabase project** before using Dashboard, History, Profile, or persistent Tutor sessions.

For example with a linked Supabase CLI project:

```bash
supabase db push
```

Do not apply this migration to an unrelated Supabase project.

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Configure:

```env
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_FEEDBACK_MODEL=gemini-2.5-flash

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`GEMINI_FEEDBACK_MODEL` is optional; it defaults to `gemini-2.5-flash`.

No Supabase service-role key is needed.

4. Enable Supabase Email authentication.

5. Add the local Auth redirect URLs:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`

Add the corresponding production URLs before deploying.

6. Apply the database migration.

7. Start the app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Session lifecycle

A database session is deliberately **not** created when somebody merely opens or connects to the Tutor.

```text
Connect to Gemini Live
      ↓
Receive partial transcript → UI only
      ↓
First finalized user turn
      ↓
Atomically create learning session + buffered finalized turns
      ↓
Persist subsequent finalized turns in order
      ↓
Disconnect / unexpected close
      ↓
Idempotently finalize duration and transcript
      ↓
Generate structured feedback after the response
      ↓
History + Dashboard reflect persisted data
```

A completed session counts toward the practice streak only when it contains at least one finalized user message and lasts at least 60 seconds.

## Feedback safety

Conversation transcripts are untrusted user data.

The feedback pipeline:

1. reads only the current user's persisted session through RLS;
2. limits transcript size;
3. serializes the transcript as delimited JSON data;
4. explicitly instructs the model never to follow transcript instructions;
5. requests structured JSON output;
6. validates that JSON again locally;
7. requires every grammar correction to point to the learner transcript turn it came from;
8. discards corrections that cannot be matched to actual learner wording;
9. strips pronunciation observations because the current evidence is text-only;
10. persists feedback only after validation.

A provider or validation failure marks feedback as failed without invalidating the completed session. The user can retry feedback from session review.

## Progress analytics

Current metrics are intentionally conservative:

- total completed practice minutes
- completed sessions
- sessions this week
- meaningful-session practice streak
- unique normalized vocabulary terms
- recurring structured grammar categories
- weekly practice minutes
- recent text-derived fluency coaching trend

The fluency value is a coaching signal based on a stable transcript rubric. It is not an acoustic score, standardized exam score, or scientific proficiency grade.

## Development verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions additionally starts a disposable PostgreSQL 17 instance, applies the migration against a minimal Supabase-compatible auth stub, and verifies core RLS/policy/grant/ownership metadata.

That CI database check proves migration parsing and expected security objects. It does **not** replace a final integration test against the correctly configured Talk Tutor Supabase project.

## Live voice runtime

The Tutor uses Gemini Live model `gemini-2.5-flash-native-audio-preview-12-2025` for bidirectional native audio. Microphone PCM is sent with the browser audio context's actual sample rate, and Gemini output is decoded as 24 kHz mono PCM.

Realtime transcript state explicitly separates streaming rows from completed history, honors the SDK's optional `Transcription.finished` signal when present, remains correct when it is absent or transcription arrives after `turnComplete`, keeps interim input as a replaceable snapshot, and appends transcript chunks without repeated-word-destroying heuristics. See `docs/architecture/live-conversation.md` for the complete lifecycle, transcript, playback, interruption, cleanup, and testing model.

## Existing audio components

To add ElevenLabs conversation components separately if needed:

```bash
pnpm dlx @elevenlabs/cli@latest components add conversation
```


## Personalized learning milestone

The current personalized-learning layer adds real progress periods, current/longest streaks, defensible mistake trends, sufficient-sample skill trends, roleplay/custom/mistake-targeted practice, saved vocabulary, flashcards, simplified SM-2 review scheduling, and on-demand personalized vocabulary examples.

See `docs/architecture/personalized-learning-vocabulary.md` for exact metric definitions, practice configuration behavior, vocabulary states, review scheduling, AI cost boundaries, and security design.

The Tutor treats correction frequency and difficulty as per-session overrides. Saved defaults are managed from Profile. Custom topics, scenarios, roles, transcript-derived mistakes, and vocabulary context are untrusted prompt data.

The review schedule is enforced atomically in PostgreSQL from only the owned card ID and review rating; the browser cannot submit authoritative interval/ease/status values.
