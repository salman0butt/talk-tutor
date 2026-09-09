# Live Conversation Architecture

The `/tutor` route uses Gemini Live for bidirectional audio and transcription. This document describes the implementation on the live voice/transcript stabilization branch.

## Ownership

Application-visible state lives in the Zustand audio store:

- live connection state
- safe user-facing error text
- selected microphone ID
- mute state
- input/output levels
- current tutor agent state
- language, proficiency, voice, topic, and practice settings
- transcript state

Runtime resources do **not** live in Zustand. The store closure owns the active `LiveManager` and `LearningSessionRecorder` references. `LiveManager` exclusively owns:

- Gemini `Session`
- `MediaStream` and microphone tracks
- input/output `AudioContext`
- `MediaStreamAudioSourceNode`
- `AudioWorkletNode`
- output `GainNode` and `AnalyserNode`
- scheduled `AudioBufferSourceNode` instances
- playback timeline/queue
- connection generation

This gives every browser/provider resource one creator and one cleanup path.

## Data flow

```mermaid
flowchart LR
    UI[Tutor UI] --> Store[Zustand audio store]
    Store --> Live[LiveManager]
    Live --> Mic[getUserMedia]
    Mic --> InputCtx[Input AudioContext]
    InputCtx --> Worklet[Mic AudioWorklet ~20 ms chunks]
    Worklet --> PCM[Float32 to Int16 PCM]
    PCM --> Gemini[Gemini Live session]

    Gemini --> Normalize[normalizeGeminiMessage]
    Normalize --> Transcript[Pure transcript reducer]
    Transcript --> Store
    Transcript --> Recorder[LearningSessionRecorder]

    Normalize --> Queue[Serialized playback queue]
    Queue --> OutputCtx[24 kHz output AudioContext]
    OutputCtx --> Speaker[Browser output]
    Store --> UI
```

## Session lifecycle

The UI uses explicit states:

```text
DISCONNECTED
  -> CONNECTING        token request
  -> REQUESTING_PERMISSION
  -> CONNECTING        audio graph + Gemini connection
  -> CONNECTED
  -> DISCONNECTING
  -> DISCONNECTED
```

Expected failures may enter `ERROR`. A retry starts a new explicit connection attempt.

The store maintains a connection-attempt number for token-request cancellation. `LiveManager` independently maintains a monotonically increasing generation. Async media/provider work and provider callbacks mutate state only when their generation is still current.

Manual disconnect invalidates the active generation before closing resources. That prevents a late `getUserMedia`, Gemini callback, or decode completion from resurrecting a stale session.

There is no automatic reconnect loop.

## Microphone pipeline

```text
selected microphone
  -> getUserMedia (mono, echo cancellation, noise suppression, AGC)
  -> input AudioContext
  -> MediaStreamAudioSourceNode
  -> mic-processor AudioWorklet
  -> ~20 ms Float32 chunks
  -> Int16 little-endian PCM
  -> Gemini sendRealtimeInput
```

The requested input context rate is 16 kHz, but browsers/devices may use a different actual rate. PCM metadata therefore uses `inputAudioContext.sampleRate` rather than blindly declaring 16 kHz. Gemini can resample raw PCM when the declared MIME rate is accurate.

Mute disables the microphone track and also prevents worklet chunks from being sent. The selected device ID is passed to `getUserMedia` on the next connection.

The worklet batches render quanta into approximately 20 ms chunks instead of posting every 128-frame quantum. This reduces main-thread/provider send frequency without introducing a large buffering subsystem.

## Gemini boundary

Provider-specific server message interpretation is centralized in:

```text
lib/live/gemini-events.ts
```

It converts `LiveServerMessage` into only the signals the application needs:

- interim input transcript
- final input transcript
- output transcript fragment
- interruption
- turn completion
- audio chunks
- waiting/in-progress flags

All audio parts in a model turn are inspected. The implementation does not assume audio is always `parts[0]`.

The configured model is:

```text
gemini-2.5-flash-native-audio-preview-12-2025
```

It remains a supported Gemini Live native-audio model. The previous `09-2025` preview identifier is no longer in the current Live model catalog.

Native-audio models choose spoken language automatically. The selected language remains part of the tutor system instruction rather than setting an unsupported native-audio speech language code.

## Transcript model

`lib/live/transcript.ts` is a pure reducer with no React, Zustand, Gemini connection, microphone, or Web Audio dependency.

A transcript message has:

- stable local ID
- `user` or `assistant` speaker
- text
- `streaming` or `complete` status
- start/completion timestamps

The state keeps explicit input/output streaming buffers and immutable completed rows.

### Input semantics

`interimInputTranscription` is treated as a replaceable low-latency snapshot.

`inputTranscription` is merged defensively. The merge accepts both:

- delta fragments such as `"I "`, `"want "`, `"coffee"`
- cumulative/repeated snapshots such as `"I"`, `"I want"`, `"I want coffee"`

Overlapping/repeated text is deduplicated.

### Output semantics

Output transcription uses the same overlap/cumulative-safe merge. A single assistant row is updated while streaming and finalized at interruption or turn completion.

Because Gemini documents input/output transcription as independent from model-turn ordering, the first observed assistant output provides a practical boundary for finalizing the current user turn. `turnComplete` is a fallback boundary for any remaining user text and the normal assistant-finalization boundary.

### Interruption

When an interrupted update arrives:

1. any transcript fragment carried by that server update is applied;
2. the assistant streaming transcript is finalized once;
3. playback is reset immediately;
4. audio bytes carried by the interrupted server update are discarded;
5. future model audio is allowed on a fresh playback epoch.

This preserves valid observed text without replaying obsolete speech.

Whitespace-only events never create rows. A new connection creates a new transcript-session identity, so streaming buffers cannot leak across reconnects.

Only reducer-returned **newly completed** rows are persisted to `LearningSessionRecorder`.

## Playback

Gemini native audio output is decoded as mono 16-bit PCM at 24 kHz.

Audio chunks pass through one promise chain before scheduling. This prevents asynchronous decode completion from reordering chunks.

Each queued chunk captures a playback epoch. Interruption or disconnect increments the epoch, stops active sources, clears the source collection, resets `nextStartTime`, and starts a fresh queue. A decode that completes after its epoch became stale is ignored.

`ended` handlers remove sources from the collection and disconnect their nodes.

## Cleanup

`disconnect()` is intentionally safe to call repeatedly.

Cleanup:

- invalidates the current connection generation
- optionally closes the Gemini session
- cancels output-level animation
- increments/reset playback epoch and stops queued/active output
- clears the worklet message callback and closes its port
- disconnects source/worklet/output nodes
- stops all microphone tracks
- closes audio contexts
- resets runtime references and playback timeline
- resets mute/audio-level/agent state

Independent cleanup operations are best-effort so one node that is already closed does not prevent later resources from being released.

## Error handling

Live runtime errors use stable internal codes with safe messages:

- `microphone_permission_denied`
- `microphone_unavailable`
- `live_connection_failed`
- `audio_worklet_failed`
- `audio_decode_failed`
- `session_closed`
- `unknown`

Ephemeral tokens, API keys, raw audio, and full transcripts are not logged.

The existing authenticated `/api/token` endpoint remains the credential boundary; the Gemini API key stays server-side.

## Rendering and scrolling

The transcript UI subscribes only to transcript messages, so audio-level updates do not force it to rebuild the transcript array.

`use-stick-to-bottom` follows new content while the user is at the bottom and exposes a "scroll to latest" control after the user scrolls upward.

Desktop retains the right transcript sidebar. Mobile now exposes a bounded transcript panel instead of hiding transcript functionality below the `lg` breakpoint.

## Tests

Deterministic tests cover:

- interim input snapshots
- final/delta input fragments
- cumulative/duplicate transcript events
- assistant streaming and finalization
- speaker ordering
- interruption
- whitespace
- reconnect isolation
- stable message IDs
- Gemini message normalization
- all model-turn audio parts
- PCM bounds, clamping, byte length, and actual sample-rate metadata

Browser-owned resources are verified at the integration/E2E layer rather than by building a single test that mocks `window`, `navigator`, AudioContext, Gemini, Zustand, and React simultaneously.
