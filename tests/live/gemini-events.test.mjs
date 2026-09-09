import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeminiMessage } from '../../lib/live/gemini-events.ts';

test('normalizes interim, final input, output and turn boundary in provider order', () => {
  const result = normalizeGeminiMessage(
    {
      serverContent: {
        interimInputTranscription: { text: 'I want' },
        inputTranscription: { text: 'I want coffee' },
        outputTranscription: { text: 'Sure.' },
        turnComplete: true,
      },
    },
    1234,
  );

  assert.deepEqual(result.transcriptEvents, [
    { type: 'input-interim', text: 'I want', at: 1234 },
    { type: 'input-final', text: 'I want coffee', at: 1234 },
    { type: 'output-fragment', text: 'Sure.', at: 1234 },
    { type: 'turn-complete', at: 1234 },
  ]);
});

test('collects every inline audio part instead of only the first part', () => {
  const result = normalizeGeminiMessage(
    {
      serverContent: {
        modelTurn: {
          parts: [
            { inlineData: { data: 'audio-1', mimeType: 'audio/pcm;rate=24000' } },
            { text: 'metadata text' },
            { inlineData: { data: 'audio-2', mimeType: 'audio/pcm;rate=24000' } },
            { inlineData: { data: 'image', mimeType: 'image/png' } },
          ],
        },
      },
    },
    1,
  );

  assert.deepEqual(result.audioChunks, ['audio-1', 'audio-2']);
});

test('maps interruption before the following transcript boundary', () => {
  const result = normalizeGeminiMessage(
    {
      serverContent: {
        interrupted: true,
        outputTranscription: { text: 'partial reply' },
        turnComplete: true,
      },
    },
    99,
  );

  assert.deepEqual(result.transcriptEvents, [
    { type: 'output-fragment', text: 'partial reply', at: 99 },
    { type: 'interrupted', at: 99 },
    { type: 'turn-complete', at: 99 },
  ]);
  assert.equal(result.interrupted, true);
});

test('returns empty normalized content when serverContent is absent', () => {
  assert.deepEqual(normalizeGeminiMessage({}, 10), {
    transcriptEvents: [],
    audioChunks: [],
    interrupted: false,
    turnComplete: false,
    waitingForInput: false,
    interactionInProgress: false,
  });
});
