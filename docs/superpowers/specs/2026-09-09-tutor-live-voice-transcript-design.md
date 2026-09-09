# Tutor Live Voice & Transcript Stabilization Design

## Status

Implementation design for the focused `/tutor` realtime voice/transcript repair. This branch is stacked on `feat/personalized-learning-vocabulary` because that open branch contains the newest Tutor/session persistence behavior.

## Problem

The existing realtime subsystem mixes provider event interpretation, transcript accumulation, Web Audio resource ownership, playback scheduling, microphone streaming, and lifecycle state inside `LiveManager`, while Zustand independently mutates transcript and connection state.

The investigation found concrete correctness risks:

1. `LiveManager` accumulates transcript fragments internally but sends only the latest fragment to the store for streaming UI, so the UI replaces the current row with the latest chunk instead of the accumulated utterance.
2. Input and output transcription are flushed together on `serverContent.turnComplete`, even though the installed Google GenAI SDK documents them as independent of model-turn ordering. Current SDK behavior also exposes no consistently reliable per-transcription `finished` flag for native-audio conversations.
3. The hard-coded Live model is `gemini-2.5-flash-native-audio-preview-09-2025`, while Google's current Live model catalog lists newer supported replacements.
4. Gemini audio playback only reads `modelTurn.parts[0]`, while provider examples iterate all model-turn parts.
5. Audio chunks are decoded concurrently. A slower decode can allow a later chunk to schedule first, breaking spoken ordering.
6. Manual interruption stops current sources but cannot cancel already-decoding/queued stale chunks, so obsolete audio can re-enter playback.
7. Session connect marks the app connected from Gemini's `onopen` before microphone/audio initialization is guaranteed complete.
8. `startSession` failure does not reliably clean every partially created browser/provider resource.
9. Connect/disconnect have no generation identity. Stale async work or provider callbacks can mutate a newer session.
10. The store performs a throwaway microphone permission request and `LiveManager` requests another stream, splitting resource ownership and ignoring the microphone selected in the UI.
11. PCM blobs always declare 16 kHz even though browser audio contexts/device graphs may run at another actual sample rate.
12. The worklet sends one 128-frame message per render quantum (roughly 125 messages/sec at 16 kHz), far above the provider's normal 20–40 ms streaming guidance.
13. Transcript row IDs use `Date.now()`, which is not a deliberate turn identity.
14. The current status UI has no explicit requesting-permission/disconnecting presentation and shows the default ready badge after errors.

## Current data flow

### Input

```text
ControlsPanel
  -> Zustand connect()
  -> /api/token
  -> temporary getUserMedia permission stream (store)
  -> LiveManager.startSession()
  -> Gemini live.connect()
  -> AudioContext(16k requested)
  -> AudioWorklet mic-processor
  -> second getUserMedia stream
  -> Float32 chunks
  -> createPCMBlob()
  -> session.sendRealtimeInput()
```

### Output

```text
Gemini LiveServerMessage
  -> serverContent.modelTurn.parts[0].inlineData.data
  -> decodeAudioData()
  -> AudioBufferSourceNode
  -> GainNode
  -> AnalyserNode
  -> AudioContext destination
```

### Transcript

```text
Gemini LiveServerMessage
  -> LiveManager fragment buffers
  -> onTranscript(sender, latestChunk, partial=true)
  -> Zustand finds one partial row per sender and replaces its text
  -> turnComplete
  -> onTranscript(sender, accumulatedText, partial=false)
  -> Zustand commits row + LearningSessionRecorder
  -> RightSidebar
```

## Target architecture

Keep `LiveManager` as the orchestration boundary. Do not create a hierarchy of services.

```text
Tutor UI
  -> Zustand audio store (application-visible state/actions)
  -> LiveManager (runtime orchestration)
       -> Web Audio microphone/worklet resources
       -> Gemini Live session
       -> serialized playback queue
       -> normalized transcript signals
  -> pure transcript state transition
  -> LearningSessionRecorder for completed transcript turns
```

### State ownership

Zustand owns application-visible state:

- lifecycle state
- selected language/proficiency/voice/practice settings
- selected microphone
- mute
- audio levels
- transcript state/messages
- user-facing error

`LiveManager` owns runtime resources:

- Gemini `Session`
- media stream and tracks
- input/output `AudioContext`
- worklet/source nodes
- output gain/analyser/source nodes
- playback queue/timeline
- connection generation

No browser/provider resource is stored as canonical UI state.

## Transcript model

Use an explicit transcript state containing immutable completed messages and at most one streaming message per speaker. Message identity is session-generation + local sequence, not wall-clock time.

Provider-facing normalized signals:

- input interim snapshot
- input final fragment
- output fragment
- turn complete
- interruption
- reset/new session

Rules:

- interim user text updates the current user row in place;
- final input fragments accumulate without duplicating interim snapshots;
- the first assistant output fragment finalizes the current user turn before creating/updating the assistant row;
- model `turnComplete` finalizes assistant output and provides a fallback user flush when needed;
- interruption finalizes the currently observed assistant text once, clears its streaming buffer, and resets playback;
- whitespace cannot create a row;
- reconnect starts a new transcript session identity and clears only streaming state/history according to current product behavior (the current product clears the UI transcript on a new connection);
- completed rows are never modified by later partials.

The pure transcript transition returns any newly completed messages so the store can persist exactly those turns.

## Lifecycle and race strategy

Use a monotonically increasing connection generation in `LiveManager`.

Every `startSession` captures its generation. Provider callbacks and async setup steps may mutate state only if they still belong to the active generation. `disconnect()` invalidates the generation before closing resources, so late token/media/provider work cannot resurrect the session.

Lifecycle values:

- DISCONNECTED
- REQUESTING_PERMISSION
- CONNECTING
- CONNECTED
- DISCONNECTING
- ERROR

Manual reconnect remains explicit; no automatic reconnect loop is introduced.

## Microphone and PCM

`LiveManager` becomes the sole owner of the real microphone stream. The store no longer opens a temporary permission stream.

The selected UI device ID is passed to `getUserMedia` when present.

The input `AudioContext` may request 16 kHz, but PCM MIME metadata uses the context's actual `sampleRate`. Gemini Live accepts raw 16-bit little-endian PCM and can resample non-16-kHz input when the MIME rate is accurate.

PCM conversion remains a pure utility with deterministic tests for clamping, zero, byte length, and MIME sample rate.

The worklet batches render quanta into roughly 20 ms messages before posting to the main thread, reducing needless realtime send/state-update frequency without adding a buffering subsystem.

## Playback

Keep playback scheduling inside `LiveManager`, but serialize decode/schedule work through one promise chain.

Each audio chunk captures a playback epoch. Interruption/disconnect increments the epoch, stops active sources, resets `nextStartTime`, and makes stale in-flight decode results no-ops. New audio can start immediately on a fresh queue.

All model-turn parts are inspected for inline audio payloads.

## Cleanup

Cleanup is idempotent and best-effort across all resources. One cleanup error must not prevent later cleanup steps.

Cleanup deliberately:

- invalidates stale worklet callbacks;
- closes/stops the Gemini session when requested;
- cancels the output-level animation frame;
- stops all scheduled/active audio;
- clears the playback epoch/timeline;
- disconnects input source/worklet/output graph;
- closes the worklet message port;
- stops all media tracks;
- closes audio contexts;
- clears transcript runtime buffers;
- resets mute/audio levels/agent state.

## Error model

Expose a small structured live error with a stable code and safe user message:

- microphone_permission_denied
- microphone_unavailable
- live_connection_failed
- audio_worklet_failed
- audio_decode_failed
- session_closed
- unknown

Provider/session credentials and raw audio are never logged.

## Testing

Add deterministic Node tests for:

- transcript interim/final accumulation;
- input -> assistant ordering;
- multiple turns;
- interruption;
- whitespace handling;
- reconnect reset;
- stable identities;
- PCM conversion and declared sample rate.

The existing GitHub Actions pipeline remains the authoritative executable gate in this environment and will run lint, typecheck, unit tests, migrations/RLS checks, and production build on the branch/PR.

Browser/provider E2E must additionally verify the deployed/locally authenticated `/tutor` flow when an interactive browser with microphone + app credentials is available.

## Non-goals

- no state-machine dependency;
- no automatic reconnect;
- no generic event bus;
- no AudioService/Transport factory hierarchy;
- no audio recording persistence;
- no replacement of the learning-session persistence subsystem;
- no unrelated redesign of the Tutor page.
