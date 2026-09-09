import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningSessionRecorder } from '../../lib/learning/session-recorder.ts';

function fakeApi() {
  const calls = { create: [], append: [], finalize: [] };
  return {
    calls,
    api: {
      async createSession(config, messages) {
        calls.create.push({ config, messages });
        return '550e8400-e29b-41d4-a716-446655440000';
      },
      async appendMessage(sessionId, message) {
        calls.append.push({ sessionId, message });
      },
      async finalizeSession(sessionId) {
        calls.finalize.push(sessionId);
        return { id: sessionId, status: 'completed' };
      },
    },
  };
}

const config = {
  language: 'fr-FR',
  proficiencyLevel: 'Intermediate',
  topic: 'Travel & Directions',
  assistantVoice: 'Aoede',
};

test('does not create a DB session for assistant-only or empty turns', async () => {
  const { api, calls } = fakeApi();
  const recorder = new LearningSessionRecorder(api);
  recorder.begin(config);
  await recorder.recordFinalTurn('assistant', 'Bonjour', '2026-09-09T10:00:00Z');
  await recorder.recordFinalTurn('user', '   ', '2026-09-09T10:00:02Z');
  assert.equal(calls.create.length, 0);
});

test('first finalized user turn creates exactly one session with buffered greeting', async () => {
  const { api, calls } = fakeApi();
  const recorder = new LearningSessionRecorder(api);
  recorder.begin(config);
  await recorder.recordFinalTurn('assistant', 'Bonjour!', '2026-09-09T10:00:00Z');
  await recorder.recordFinalTurn('user', 'Salut!', '2026-09-09T10:00:03Z');
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.create[0].messages.map((m) => [m.role, m.text, m.sequence]), [
    ['assistant', 'Bonjour!', 0],
    ['user', 'Salut!', 1],
  ]);
});

test('later finalized turns append in sequence after session creation', async () => {
  const { api, calls } = fakeApi();
  const recorder = new LearningSessionRecorder(api);
  recorder.begin(config);
  await recorder.recordFinalTurn('user', 'Hello', '2026-09-09T10:00:00Z');
  await recorder.recordFinalTurn('assistant', 'Hi there', '2026-09-09T10:00:02Z');
  await recorder.recordFinalTurn('user', 'How are you?', '2026-09-09T10:00:04Z');
  assert.deepEqual(calls.append.map((call) => call.message.sequence), [1, 2]);
});

test('finalization is idempotent and waits for queued transcript writes', async () => {
  const { api, calls } = fakeApi();
  const recorder = new LearningSessionRecorder(api);
  recorder.begin(config);
  const first = recorder.recordFinalTurn('user', 'Hello', '2026-09-09T10:00:00Z');
  const second = recorder.recordFinalTurn('assistant', 'Welcome', '2026-09-09T10:00:02Z');
  await Promise.all([first, second]);
  await Promise.all([recorder.finalize(), recorder.finalize()]);
  assert.equal(calls.create.length, 1);
  const persistedMessages = calls.create[0].messages.length + calls.append.length;
  assert.equal(persistedMessages, 2);
  assert.equal(calls.finalize.length, 1);
});

test('creation failure keeps buffered messages so a later final turn can retry', async () => {
  let attempts = 0;
  const calls = [];
  const api = {
    async createSession(_config, messages) {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary failure');
      calls.push(messages.map((m) => m.text));
      return '550e8400-e29b-41d4-a716-446655440000';
    },
    async appendMessage() {},
    async finalizeSession(sessionId) { return { id: sessionId, status: 'completed' }; },
  };
  const recorder = new LearningSessionRecorder(api);
  recorder.begin(config);
  await assert.rejects(recorder.recordFinalTurn('user', 'First', '2026-09-09T10:00:00Z'));
  await recorder.recordFinalTurn('assistant', 'Second', '2026-09-09T10:00:02Z');
  assert.equal(attempts, 2);
  assert.deepEqual(calls[0], ['First', 'Second']);
});


test('finalize retries a failed initial session creation before giving up buffered user turns', async () => {
  let createAttempts = 0;
  const calls = { finalize: 0 };
  const api = {
    async createSession() {
      createAttempts += 1;
      if (createAttempts === 1) throw new Error('temporary database failure');
      return '550e8400-e29b-41d4-a716-446655440000';
    },
    async appendMessage() {},
    async finalizeSession() {
      calls.finalize += 1;
      return { status: 'completed' };
    },
  };

  const recorder = new LearningSessionRecorder(api);
  recorder.begin(config);

  await assert.rejects(
    recorder.recordFinalTurn('user', 'Please keep this turn', '2026-09-09T10:00:00Z'),
    /temporary database failure/,
  );

  await recorder.finalize();

  assert.equal(createAttempts, 2);
  assert.equal(calls.finalize, 1);
});
