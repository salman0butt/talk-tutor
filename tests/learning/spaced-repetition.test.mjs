import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleVocabularyReview,
  isVocabularyDue,
} from '../../lib/learning/spaced-repetition.ts';

const CLOCK = '2026-09-09T12:00:00.000Z';
const fresh = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitionCount: 0,
  status: 'learning',
};

test('new vocabulary is due immediately when next review is at or before the fixed clock', () => {
  assert.equal(isVocabularyDue('2026-09-09T12:00:00.000Z', CLOCK), true);
  assert.equal(isVocabularyDue('2026-09-09T12:00:01.000Z', CLOCK), false);
});

test('Again resets repetitions, lowers ease and schedules one day', () => {
  assert.deepEqual(scheduleVocabularyReview(fresh, 'again', CLOCK), {
    easeFactor: 2.3,
    intervalDays: 1,
    repetitionCount: 0,
    status: 'learning',
    nextReviewAt: '2026-09-10T12:00:00.000Z',
    lastReviewedAt: CLOCK,
  });
});

test('Hard grows interval conservatively with a minimum of one day', () => {
  assert.deepEqual(scheduleVocabularyReview({ ...fresh, intervalDays: 10, repetitionCount: 2 }, 'hard', CLOCK), {
    easeFactor: 2.35,
    intervalDays: 12,
    repetitionCount: 3,
    status: 'learning',
    nextReviewAt: '2026-09-21T12:00:00.000Z',
    lastReviewedAt: CLOCK,
  });
});

test('Good follows first, second and later simplified SM-2 intervals', () => {
  const first = scheduleVocabularyReview(fresh, 'good', CLOCK);
  assert.equal(first.intervalDays, 1);
  assert.equal(first.repetitionCount, 1);

  const second = scheduleVocabularyReview(first, 'good', CLOCK);
  assert.equal(second.intervalDays, 3);
  assert.equal(second.repetitionCount, 2);

  const third = scheduleVocabularyReview(second, 'good', CLOCK);
  assert.equal(third.intervalDays, 8);
  assert.equal(third.repetitionCount, 3);
});

test('Easy accelerates interval and raises ease', () => {
  const first = scheduleVocabularyReview(fresh, 'easy', CLOCK);
  assert.equal(first.intervalDays, 3);
  assert.equal(first.easeFactor, 2.65);
  const second = scheduleVocabularyReview(first, 'easy', CLOCK);
  assert.equal(second.intervalDays, 7);
  assert.equal(second.easeFactor, 2.8);
});

test('failed review after successful reviews resets repetitions but preserves deterministic schedule', () => {
  const established = { easeFactor: 2.7, intervalDays: 30, repetitionCount: 5, status: 'strong' };
  const result = scheduleVocabularyReview(established, 'again', CLOCK);
  assert.equal(result.repetitionCount, 0);
  assert.equal(result.intervalDays, 1);
  assert.equal(result.status, 'learning');
  assert.equal(result.easeFactor, 2.5);
});

test('strong status requires five repetitions and a 21-day interval', () => {
  const result = scheduleVocabularyReview({ easeFactor: 2.5, intervalDays: 10, repetitionCount: 4, status: 'learning' }, 'good', CLOCK);
  assert.equal(result.repetitionCount, 5);
  assert.ok(result.intervalDays >= 21);
  assert.equal(result.status, 'strong');
});

test('invalid ratings and invalid clocks are rejected', () => {
  assert.throws(() => scheduleVocabularyReview(fresh, 'perfect', CLOCK), /rating/i);
  assert.throws(() => scheduleVocabularyReview(fresh, 'good', 'not-a-date'), /date/i);
});
