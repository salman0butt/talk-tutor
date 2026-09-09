import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePracticeMinutes,
  calculateStreakSummary,
  aggregateMistakeTrends,
  calculateSkillTrend,
  calculateVocabularyGrowth,
} from '../../lib/learning/progress.ts';

const NOW = '2026-09-09T12:00:00Z';

test('practice minutes exclude abandoned and empty sessions and compare calendar periods', () => {
  const sessions = [
    { status: 'completed', durationSeconds: 125, userMessageCount: 2, endedAt: '2026-09-09T08:00:00Z' },
    { status: 'completed', durationSeconds: 65, userMessageCount: 1, endedAt: '2026-09-08T08:00:00Z' },
    { status: 'completed', durationSeconds: 180, userMessageCount: 0, endedAt: '2026-09-07T08:00:00Z' },
    { status: 'abandoned', durationSeconds: 600, userMessageCount: 4, endedAt: '2026-09-06T08:00:00Z' },
    { status: 'completed', durationSeconds: 180, userMessageCount: 1, endedAt: '2026-09-01T08:00:00Z' },
  ];

  assert.deepEqual(calculatePracticeMinutes(sessions, 'UTC', NOW), {
    totalMinutes: 6,
    thisWeekMinutes: 3,
    thisMonthMinutes: 6,
    previousWeekMinutes: 3,
    completedSessions: 3,
  });
});

test('streak summary uses meaningful 60-second sessions, one day once, and tracks longest streak', () => {
  const sessions = [
    { status: 'completed', durationSeconds: 80, userMessageCount: 1, endedAt: '2026-09-09T09:00:00Z' },
    { status: 'completed', durationSeconds: 120, userMessageCount: 2, endedAt: '2026-09-09T10:00:00Z' },
    { status: 'completed', durationSeconds: 60, userMessageCount: 1, endedAt: '2026-09-08T09:00:00Z' },
    { status: 'completed', durationSeconds: 61, userMessageCount: 1, endedAt: '2026-09-07T09:00:00Z' },
    { status: 'completed', durationSeconds: 59, userMessageCount: 3, endedAt: '2026-09-06T09:00:00Z' },
    { status: 'completed', durationSeconds: 70, userMessageCount: 1, endedAt: '2026-09-04T09:00:00Z' },
    { status: 'completed', durationSeconds: 70, userMessageCount: 1, endedAt: '2026-09-03T09:00:00Z' },
    { status: 'completed', durationSeconds: 70, userMessageCount: 1, endedAt: '2026-09-02T09:00:00Z' },
    { status: 'completed', durationSeconds: 70, userMessageCount: 1, endedAt: '2026-09-01T09:00:00Z' },
  ];

  assert.deepEqual(calculateStreakSummary(sessions, 'UTC', NOW), {
    current: 3,
    longest: 4,
    practicedToday: true,
    activeDaysThisWeek: 3,
    activeDateKeys: ['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-07','2026-09-08','2026-09-09'],
  });
});

test('current streak can continue from yesterday when today has no qualifying practice', () => {
  const sessions = [
    { status: 'completed', durationSeconds: 60, userMessageCount: 1, endedAt: '2026-09-08T23:00:00Z' },
    { status: 'completed', durationSeconds: 60, userMessageCount: 1, endedAt: '2026-09-07T23:00:00Z' },
  ];
  const summary = calculateStreakSummary(sessions, 'UTC', NOW);
  assert.equal(summary.current, 2);
  assert.equal(summary.practicedToday, false);
});

test('mistake trends count affected sessions and suppress trend labels without enough samples', () => {
  const corrections = [
    { category: 'articles', sessionId: 'a', endedAt: '2026-09-09T08:00:00Z' },
    { category: 'articles', sessionId: 'b', endedAt: '2026-09-08T08:00:00Z' },
    { category: 'articles', sessionId: 'c', endedAt: '2026-09-02T08:00:00Z' },
    { category: 'articles', sessionId: 'd', endedAt: '2026-09-01T08:00:00Z' },
    { category: 'articles', sessionId: 'e', endedAt: '2026-08-31T08:00:00Z' },
    { category: 'verb_tense', sessionId: 'f', endedAt: '2026-09-09T08:00:00Z' },
    { category: 'verb_tense', sessionId: 'g', endedAt: '2026-09-01T08:00:00Z' },
  ];
  const result = aggregateMistakeTrends(corrections, 'UTC', NOW);
  assert.deepEqual(result[0], {
    category: 'articles',
    count: 5,
    affectedSessions: 5,
    recentCount: 2,
    previousCount: 3,
    trend: 'improving',
  });
  const tense = result.find((row) => row.category === 'verb_tense');
  assert.equal(tense.trend, null);
});

test('skill trend requires three scored sessions and never fabricates a percentage', () => {
  assert.deepEqual(calculateSkillTrend([70, 74]), {
    status: 'insufficient',
    current: null,
    baseline: null,
    delta: null,
    scores: [70, 74],
  });
  assert.deepEqual(calculateSkillTrend([60, 67, 72]), {
    status: 'ready',
    current: 72,
    baseline: 60,
    delta: 12,
    scores: [60, 67, 72],
  });
});

test('vocabulary growth reports saved, learning, strong, new-this-week and due counts from real items', () => {
  const items = [
    { createdAt: '2026-09-09T08:00:00Z', status: 'learning', nextReviewAt: '2026-09-09T11:00:00Z' },
    { createdAt: '2026-09-08T08:00:00Z', status: 'strong', nextReviewAt: '2026-09-20T11:00:00Z' },
    { createdAt: '2026-09-01T08:00:00Z', status: 'learning', nextReviewAt: '2026-09-10T11:00:00Z' },
  ];
  assert.deepEqual(calculateVocabularyGrowth(items, 'UTC', NOW), {
    saved: 3,
    learning: 2,
    strong: 1,
    newThisWeek: 2,
    due: 1,
  });
});
