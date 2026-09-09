# Talk Tutor

Talk Tutor is a real-time AI language speaking tutor built with Next.js, React, Gemini Live audio, and Supabase Auth.

## What is included

- Public SaaS landing page
- Email/password signup and sign in
- Email confirmation callback
- Forgot-password and reset-password flows
- HttpOnly authentication cookies
- Protected `/tutor` workspace
- Protected Gemini ephemeral-token endpoint
- Real-time language conversation interface
- Language, topic, proficiency, and voice selection
- Live transcript and audio visualization

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Set `GEMINI_API_KEY`.

4. Create a Supabase project and enable Email authentication.

5. Add your Supabase project URL and anon/publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

6. In Supabase Authentication URL Configuration, add these redirect URLs for local development:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`

Add the equivalent production URLs before deploying.

7. Start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication flow

The app uses Supabase Auth's REST endpoints directly, so no extra authentication package is required. Successful sessions are stored in secure HttpOnly cookies. The tutor route validates the current user server-side before rendering, and `/api/token` validates the same session before minting a Gemini ephemeral token.

## Existing audio components

To add ElevenLabs conversation components separately if needed:

```bash
pnpm dlx @elevenlabs/cli@latest components add conversation
```
