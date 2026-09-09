import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendedPractice } from '../../lib/learning/recommendations.ts';

test('recommendations prioritize due review, recurring mistakes, target gap, then goal roleplay', () => {
  const result = buildRecommendedPractice({
    dueVocabularyCount: 8,
    mistakes: [{ category: 'articles', count: 6, recentCount: 4, affectedSessions: 4, trend: 'needs_practice' }],
    minutesToday: 5,
    dailyTargetMinutes: 15,
    learningGoal: 'interview_preparation',
  });
  assert.deepEqual(result.map((item) => item.kind), [
    'vocabulary_review',
    'mistake_practice',
    'daily_goal',
    'roleplay',
  ]);
  assert.match(result[0].reason, /8/);
  assert.match(result[1].reason, /articles/i);
});

test('recommendations fall back to conversation when no stronger signal exists', () => {
  const result = buildRecommendedPractice({
    dueVocabularyCount: 0,
    mistakes: [],
    minutesToday: 20,
    dailyTargetMinutes: 15,
    learningGoal: 'general_fluency',
  });
  assert.deepEqual(result.map((item) => item.kind), ['conversation']);
});
