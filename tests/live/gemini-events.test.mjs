import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeminiMessage } from '../../lib/live/gemini-events.ts';

test('normalizes interim and finalized transcription signals with SDK finished flags', () => {
  const result = normalizeGeminiMessage(
    {
      serverContent: {
        interimInputTranscription: { text: 'I want' },
        inputTranscription: { text: 'I want coffee', finished: true },
        outputTranscription: { text: 'Sure.', finished: false },
        turnComplete: true,
      },
    },
    1234,
  );

  assert.deepEqual(result.transcriptEvents, [
    { type: 'input-interim', text: 'I want', at: 1234 },
    {
      type: 'input-transcription',
      text: 'I want coffee',
      finished: true,
      at: 1234,
    },
    {
      type: 'output-transcription',
      text: 'Sure.',
      finished: false,
      at: 1234,
    },
    { type: 'turn-complete', at: 1234 },
  ]);
});

test('collects every inline audio part instead of only the first part', () => {
  const result = normalizeGeminiMessage(
    {
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                data: 'audio-1',
                mimeType: 'audio/pcm;rate=24000',
              },
            },
            { text: 'metadata text' },
            {
              inlineData: {
                data: 'audio-2',
                mimeType: 'audio/pcm;rate=24000',
              },
            },
            {
              inlineData: {
                data: 'image',
                mimeType: 'image/png',
              },
            },
          ],
        },
      },
    },
    1,
  );

  assert.deepEqual(result.audioChunks, ['audio-1', 'audio-2']);
});

test('keeps the last output transcript fragment before interruption and turn completion', () => {
  const result = normalizeGeminiMessage(
    {
      serverContent: {
        interrupted: true,
        outputTranscription: {
          text: 'partial reply',
          finished: false,
        },
        turnComplete: true,
      },
    },
    99,
  );

  assert.deepEqual(result.transcriptEvents, [
    {
      type: 'output-transcription',
      text: 'partial reply',
      finished: false,
      at: 99,
    },
    { type: 'interrupted', at: 99 },
    { type: 'turn-complete', at: 99 },
  ]);
  assert.equal(result.interrupted, true);
});

test('normalizes user activity start before server boundaries so barge-in remains active', () => {
  const result = normalizeGeminiMessage(
    {
      voiceActivity: {
        voiceActivityType: 'ACTIVITY_START',
      },
      serverContent: {
        turnComplete: true,
      },
    },
    700,
  );

  assert.deepEqual(result.transcriptEvents, [
    { type: 'input-activity-start', at: 700 },
    { type: 'turn-complete', at: 700 },
  ]);
});

test('normalizes user activity end after server boundaries to avoid premature fallback finalization', () => {
  const result = normalizeGeminiMessage(
    {
      voiceActivity: {
        voiceActivityType: 'ACTIVITY_END',
      },
      serverContent: {
        turnComplete: true,
      },
    },
    800,
  );

  assert.deepEqual(result.transcriptEvents, [
    { type: 'turn-complete', at: 800 },
    { type: 'input-activity-end', at: 800 },
  ]);
});

test('voice activity is preserved even when serverContent is absent', () => {
  const start = normalizeGeminiMessage(
    {
      voiceActivity: {
        voiceActivityType: 'ACTIVITY_START',
      },
    },
    900,
  );

  assert.deepEqual(start.transcriptEvents, [
    { type: 'input-activity-start', at: 900 },
  ]);
  assert.deepEqual(start.audioChunks, []);
});

test('returns empty normalized content when neither server content nor voice activity is present', () => {
  assert.deepEqual(normalizeGeminiMessage({}, 10), {
    transcriptEvents: [],
    audioChunks: [],
    interrupted: false,
    turnComplete: false,
    waitingForInput: false,
    interactionInProgress: false,
  });
});
