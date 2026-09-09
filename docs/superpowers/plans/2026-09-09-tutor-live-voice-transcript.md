# Tutor Live Voice & Transcript Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Talk Tutor's realtime microphone, Gemini Live audio, transcript streaming/finalization, interruption, cleanup, and reconnect behavior deterministic and testable without over-abstracting the existing architecture.

**Architecture:** Keep `LiveManager` as the runtime orchestration layer, move deterministic transcript transitions into one pure module, keep application-visible state in Zustand, and serialize output playback inside `LiveManager` with generation/epoch guards. Browser resources remain privately owned by `LiveManager`.

**Tech Stack:** Next.js 16.1.6, React 19.2.3, TypeScript 5.9, Zustand 5, @google/genai 2.19.0, Web Audio API, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-tutor-live-voice-transcript-design.md`

## Global Constraints

- Correctness > reliability > simplicity > testability > clarity > maintainability > abstraction > cleverness.
- Do not replace `LiveManager` solely because it is large.
- No heavy state-machine library.
- Do not merge the pull request.
- Keep existing authenticated SaaS/session persistence behavior.
- Use test-first regression changes for deterministic behavior.
- Do not expose Gemini/Supabase credentials or raw audio in logs.

---

### Task 1: Characterize transcript semantics with a pure state model

**Files:**
- Create: `lib/live/transcript.ts`
- Create: `tests/live/transcript.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `TranscriptState`, `TranscriptMessage`, `TranscriptEvent`, `createTranscriptState()`, and `applyTranscriptEvent()`.
- `applyTranscriptEvent()` returns the next state plus newly completed messages.

- [ ] Write failing tests for interim user snapshots, final user fragments, assistant-start user finalization, assistant turn completion, multiple turns, interruption, whitespace, reconnect/reset, and stable local IDs.
- [ ] Add `tests/live/*.test.mjs` to the unit-test script.
- [ ] Implement the minimal pure transcript reducer.
- [ ] Run the focused tests in CI and confirm RED -> GREEN.
- [ ] Refactor helper duplication while keeping the tests green.

### Task 2: Make PCM metadata match actual capture rate

**Files:**
- Modify: `lib/audioUtils.ts`
- Create: `tests/live/audio-utils.test.mjs`

**Interfaces:**
- `createPCMBlob(data, sampleRate)` returns base64 raw Int16 PCM plus `audio/pcm;rate=<actual>`.

- [ ] Write failing conversion tests for zero, positive max, negative min, clamping, byte length/base64, and MIME sample rate.
- [ ] Change `createPCMBlob` to accept the actual sample rate.
- [ ] Keep little-endian Int16 conversion based on the platform typed-array representation used by the browser target.
- [ ] Run focused tests and full unit tests.

### Task 3: Make the live session lifecycle generation-safe

**Files:**
- Modify: `types.ts`
- Modify: `services/liveManager.ts`
- Modify: `store/useAudioStore.ts`
- Modify: `components/status-panel.tsx`
- Modify: `components/controls-panel.tsx`

**Interfaces:**
- Extend `ConnectionState` with `REQUESTING_PERMISSION` and `DISCONNECTING`.
- Add a structured safe `LiveConversationError`.
- `LiveManager.startSession()` owns microphone acquisition and accepts the chosen device ID through `ConnectConfig`.

- [ ] Remove the store's throwaway permission stream.
- [ ] Add a monotonically increasing connection generation to `LiveManager`.
- [ ] Acquire microphone/worklet/audio resources before declaring the Gemini session connected.
- [ ] Guard every async completion/provider callback with the captured generation.
- [ ] Make start failure clean partially initialized resources before reporting ERROR.
- [ ] Make `disconnect()` invalidate the generation first and remain safe when called repeatedly.
- [ ] Render requesting-permission/connecting/disconnecting/error states explicitly.
- [ ] Keep manual reconnect behavior; add no retry loop.

### Task 4: Route transcript provider signals through the pure reducer

**Files:**
- Modify: `services/liveManager.ts`
- Modify: `store/useAudioStore.ts`
- Modify: `components/right-sidebar.tsx`
- Modify: `types.ts`

**Interfaces:**
- `LiveManagerCallbacks.onTranscriptEvent(event)` replaces ambiguous `onTranscript(sender,text,isPartial)`.
- Zustand stores one `TranscriptState`; the UI reads `transcriptState.messages`.
- The store persists only messages returned as newly completed by the reducer.

- [ ] Map `interimInputTranscription`, `inputTranscription`, `outputTranscription`, `turnComplete`, and `interrupted` to normalized transcript events.
- [ ] Ensure first assistant output finalizes the current user turn.
- [ ] Ensure model turn completion finalizes assistant output once.
- [ ] Ensure interrupted assistant text remains coherent and is not duplicated.
- [ ] Reset transcript session identity on each new connection.
- [ ] Update UI speaker/status fields and keep stick-to-bottom behavior.

### Task 5: Stabilize microphone streaming and selected-device behavior

**Files:**
- Modify: `services/liveManager.ts`
- Modify: `store/useAudioStore.ts`
- Modify: `components/controls-panel.tsx`
- Modify: `public/worklet/mic-processor.js`

**Interfaces:**
- Store owns `selectedInputDeviceId`.
- `ConnectConfig.input_device_id` is optional.
- Worklet posts approximately 20 ms Float32 chunks.

- [ ] Wire `MicSelector` to the store/global mute state rather than a disconnected local-only mute prop.
- [ ] Pass selected device to `getUserMedia`.
- [ ] Use actual input `AudioContext.sampleRate` when creating PCM blobs.
- [ ] Batch worklet render quanta into about 20 ms messages.
- [ ] Clear/close worklet callbacks and ports during cleanup.

### Task 6: Serialize output audio and make interruption stale-safe

**Files:**
- Modify: `services/liveManager.ts`

**Interfaces:**
- Keep scheduling internal to `LiveManager`.
- Playback queue is a promise chain plus integer epoch; no new strategy/factory type.

- [ ] Iterate all `modelTurn.parts` inline audio payloads.
- [ ] Serialize decode/schedule calls so chunks remain ordered.
- [ ] Capture playback epoch for every queued chunk.
- [ ] On interruption/disconnect, increment epoch, stop sources, clear source set, reset timeline, and start a fresh queue.
- [ ] Ignore stale decode results after interruption.
- [ ] Surface safe audio-decode diagnostics without crashing the whole session.

### Task 7: Harden cleanup and remove dead synchronization

**Files:**
- Modify: `services/liveManager.ts`
- Modify: `store/useAudioStore.ts`

- [ ] Clear `liveManagerInstance` after disconnect/failed session.
- [ ] Reset transcript streaming state and audio levels deliberately.
- [ ] Ensure one resource cleanup failure does not skip subsequent cleanup.
- [ ] Remove random production `console.log` calls.
- [ ] Keep only safe contextual error logging.
- [ ] Search for obsolete transcript fields/actions before deleting them.

### Task 8: Update current provider configuration

**Files:**
- Modify: `lib/constants.ts`
- Modify: `README.md`

- [ ] Replace the no-longer-current `09-2025` model ID with a currently listed Live model supported by the installed SDK and native-audio flow.
- [ ] Document input/output PCM expectations and current model choice.
- [ ] Do not turn protocol constants into environment variables without a product need.

### Task 9: Document final architecture

**Files:**
- Create: `docs/architecture/live-conversation.md`
- Modify: `README.md`

- [ ] Document lifecycle, resource ownership, microphone pipeline, Gemini boundary, transcript state, playback, interruption, cleanup, and testing.
- [ ] Add a Mermaid diagram matching the implementation.
- [ ] Document real provider/browser limitations only.

### Task 10: Verification, review, and PR

**Files:** all changed files.

- [ ] Run exact-head GitHub Actions and inspect every job/step.
- [ ] Verify lint.
- [ ] Verify typecheck.
- [ ] Verify all unit tests.
- [ ] Verify production build.
- [ ] Review the complete diff for correctness, races, resources, state ownership, architecture, tests, and security.
- [ ] Fix every Critical/Important finding and rerun verification.
- [ ] Use an interactive browser with microphone/auth when available to verify desktop/mobile `/tutor`, multi-turn transcript, mute, interruption, disconnect, reconnect, and another language.
- [ ] Push final branch and create a stacked PR targeting `feat/personalized-learning-vocabulary` while PR #3 remains open.
- [ ] Leave the PR unmerged.
