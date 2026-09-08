import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasFinalUserTurn,
  calculateDurationSeconds,
  isMeaningfulCompletedSession,
  normalizePendingTurns,
} from '../../lib/learning/session-lifecycle.ts';

test('session is not eligible for creation before a finalized user turn', () => {
  assert.equal(hasFinalUserTurn([{ role: 'assistant', text: 'Hello', occurredAt: '2026-09-09T10:00:00Z' }]), false);
  assert.equal(hasFinalUserTurn([{ role: 'user', text: '   ', occurredAt: '2026-09-09T10:00:00Z' }]), false);
  assert.equal(hasFinalUserTurn([{ role: 'user', text: 'Hola', occurredAt: '2026-09-09T10:00:00Z' }]), true);
});

test('pending turns keep a pre-user assistant greeting and receive stable sequence numbers', () => {
  assert.deepEqual(
    normalizePendingTurns([
      { role: 'assistant', text: ' Hello! ', occurredAt: '2026-09-09T10:00:00Z' },
      { role: 'user', text: ' Hi! ', occurredAt: '2026-09-09T10:00:03Z' },
      { role: 'assistant', text: '   ', occurredAt: '2026-09-09T10:00:04Z' },
    ]),
    [
      { role: 'assistant', text: 'Hello!', occurredAt: '2026-09-09T10:00:00.000Z', sequence: 0 },
      { role: 'user', text: 'Hi!', occurredAt: '2026-09-09T10:00:03.000Z', sequence: 1 },
    ],
  );
});

test('duration calculation uses whole non-negative seconds', () => {
  assert.equal(calculateDurationSeconds('2026-09-09T10:00:00.000Z', '2026-09-09T10:01:04.900Z'), 64);
  assert.equal(calculateDurationSeconds('2026-09-09T10:01:00.000Z', '2026-09-09T10:00:00.000Z'), 0);
});

test('meaningful completed session requires completed status, 60 seconds and a user turn', () => {
  assert.equal(isMeaningfulCompletedSession({ status: 'completed', durationSeconds: 60, userMessageCount: 1 }), true);
  assert.equal(isMeaningfulCompletedSession({ status: 'completed', durationSeconds: 59, userMessageCount: 1 }), false);
  assert.equal(isMeaningfulCompletedSession({ status: 'completed', durationSeconds: 120, userMessageCount: 0 }), false);
  assert.equal(isMeaningfulCompletedSession({ status: 'abandoned', durationSeconds: 120, userMessageCount: 2 }), false);
});
