import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDateKey,
  calculatePracticeStreak,
  calculateDateKeyStreak,
  normalizeVocabularyTerm,
  uniqueVocabularyTerms,
  aggregateCommonMistakes,
  summarizeFluencyTrend,
} from '../../lib/learning/analytics.ts';

function session(endedAt, overrides = {}) {
  return {
    endedAt,
    durationSeconds: 120,
    userMessageCount: 2,
    status: 'completed',
    ...overrides,
  };
}

test('localDateKey respects learner timezone instead of server UTC', () => {
  assert.equal(localDateKey('2026-09-09T20:30:00.000Z', 'Asia/Karachi'), '2026-09-10');
  assert.equal(localDateKey('2026-09-09T20:30:00.000Z', 'America/Los_Angeles'), '2026-09-09');
});

test('first meaningful practice day starts a one-day streak', () => {
  const result = calculatePracticeStreak(
    [session('2026-09-09T12:00:00.000Z')],
    'UTC',
    '2026-09-09T18:00:00.000Z',
  );
  assert.equal(result, 1);
});

test('consecutive meaningful days extend the streak', () => {
  const result = calculatePracticeStreak(
    [
      session('2026-09-07T12:00:00.000Z'),
      session('2026-09-08T12:00:00.000Z'),
      session('2026-09-09T12:00:00.000Z'),
    ],
    'UTC',
    '2026-09-09T18:00:00.000Z',
  );
  assert.equal(result, 3);
});

test('two sessions on the same day count as one streak day', () => {
  const result = calculatePracticeStreak(
    [
      session('2026-09-08T09:00:00.000Z'),
      session('2026-09-08T19:00:00.000Z'),
      session('2026-09-09T12:00:00.000Z'),
    ],
    'UTC',
    '2026-09-09T18:00:00.000Z',
  );
  assert.equal(result, 2);
});

test('a missed day breaks the streak', () => {
  const result = calculatePracticeStreak(
    [session('2026-09-06T12:00:00.000Z'), session('2026-09-08T12:00:00.000Z')],
    'UTC',
    '2026-09-09T10:00:00.000Z',
  );
  assert.equal(result, 1, 'yesterday keeps the current streak alive until today ends');
});

test('month boundary is consecutive', () => {
  assert.equal(
    calculatePracticeStreak(
      [session('2026-08-31T12:00:00.000Z'), session('2026-09-01T12:00:00.000Z')],
      'UTC',
      '2026-09-01T18:00:00.000Z',
    ),
    2,
  );
});

test('year boundary is consecutive', () => {
  assert.equal(
    calculatePracticeStreak(
      [session('2025-12-31T12:00:00.000Z'), session('2026-01-01T12:00:00.000Z')],
      'UTC',
      '2026-01-01T18:00:00.000Z',
    ),
    2,
  );
});

test('short, abandoned, or user-empty sessions do not count as practice days', () => {
  assert.equal(
    calculatePracticeStreak(
      [
        session('2026-09-09T09:00:00.000Z', { durationSeconds: 59 }),
        session('2026-09-09T10:00:00.000Z', { status: 'abandoned' }),
        session('2026-09-09T11:00:00.000Z', { userMessageCount: 0 }),
      ],
      'UTC',
      '2026-09-09T18:00:00.000Z',
    ),
    0,
  );
});

test('vocabulary normalization deduplicates case, Unicode compatibility, and whitespace', () => {
  assert.equal(normalizeVocabularyTerm('  Departure   Gate '), 'departure gate');
  assert.equal(normalizeVocabularyTerm('ＦＬＵＥＮＣＹ'), 'fluency');
  assert.deepEqual(
    uniqueVocabularyTerms(['Departure', ' departure ', 'DEPARTURE', 'Arrival']),
    ['arrival', 'departure'],
  );
});

test('common mistakes aggregate stable feedback categories', () => {
  assert.deepEqual(
    aggregateCommonMistakes(['articles', 'verb_tense', 'articles', 'prepositions', 'articles']),
    [
      { category: 'articles', count: 3 },
      { category: 'prepositions', count: 1 },
      { category: 'verb_tense', count: 1 },
    ],
  );
});

test('fluency trend compares recent and previous windows without inventing a score', () => {
  assert.deepEqual(summarizeFluencyTrend([]), { current: null, previous: null, delta: null });
  assert.deepEqual(summarizeFluencyTrend([60, 64, 70, 74]), { current: 72, previous: 62, delta: 10 });
});

test('date-key streak uses already-local practice dates without reinterpreting UTC', () => {
  assert.equal(calculateDateKeyStreak(['2026-09-07', '2026-09-08', '2026-09-09'], '2026-09-09'), 3);
  assert.equal(calculateDateKeyStreak(['2026-09-07', '2026-09-08'], '2026-09-09'), 2);
  assert.equal(calculateDateKeyStreak(['2026-09-07'], '2026-09-09'), 0);
  assert.equal(calculateDateKeyStreak(['2025-12-31', '2026-01-01'], '2026-01-01'), 2);
});
