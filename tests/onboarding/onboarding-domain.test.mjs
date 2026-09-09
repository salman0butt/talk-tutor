import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLACEMENT_QUESTIONS,
  recommendLevelFromScore,
  scorePlacementAnswers,
} from '../../lib/onboarding/placement.ts';
import {
  ONBOARDING_GOALS,
  getOnboardingRecommendation,
  isOnboardingGoal,
} from '../../lib/onboarding/recommendations.ts';

test('placement test is short, deterministic, and has six objective questions', () => {
  assert.equal(PLACEMENT_QUESTIONS.length, 6);
  for (const question of PLACEMENT_QUESTIONS) {
    assert.ok(question.id);
    assert.ok(question.prompt);
    assert.ok(question.options.length >= 3);
    assert.ok(question.options.some((option) => option.id === question.correctOptionId));
  }
});

test('placement score boundaries map to existing proficiency model', () => {
  assert.equal(recommendLevelFromScore(0), 'Basic');
  assert.equal(recommendLevelFromScore(2), 'Basic');
  assert.equal(recommendLevelFromScore(3), 'Intermediate');
  assert.equal(recommendLevelFromScore(4), 'Intermediate');
  assert.equal(recommendLevelFromScore(5), 'Top Class');
  assert.equal(recommendLevelFromScore(6), 'Top Class');
  assert.throws(() => recommendLevelFromScore(-1), /score/i);
  assert.throws(() => recommendLevelFromScore(7), /score/i);
});

test('placement answers are scored from server-known answer keys', () => {
  const allCorrect = Object.fromEntries(
    PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctOptionId]),
  );
  const result = scorePlacementAnswers(allCorrect);
  assert.deepEqual(result, { score: 6, recommendedLevel: 'Top Class' });

  const oneMissing = { ...allCorrect };
  delete oneMissing[PLACEMENT_QUESTIONS[0].id];
  assert.throws(() => scorePlacementAnswers(oneMissing), /answer/i);
});

test('onboarding exposes exactly the four required learner-facing goals without deleting legacy profile semantics', () => {
  assert.deepEqual(
    ONBOARDING_GOALS.map(({ label, value }) => ({ label, value })),
    [
      { label: 'Travel', value: 'travel' },
      { label: 'Job', value: 'interview_preparation' },
      { label: 'School', value: 'academic_language' },
      { label: 'Immigration', value: 'immigration' },
    ],
  );
  assert.equal(isOnboardingGoal('travel'), true);
  assert.equal(isOnboardingGoal('immigration'), true);
  assert.equal(isOnboardingGoal('general_fluency'), false);
});

test('recommendations map goal and estimated level to deterministic practice configuration', () => {
  assert.deepEqual(getOnboardingRecommendation('travel', 'Basic'), {
    topic: 'Airport check-in',
    practiceMode: 'roleplay',
    scenarioId: 'airport-checkin',
    difficulty: 'easy',
  });
  assert.deepEqual(getOnboardingRecommendation('interview_preparation', 'Intermediate'), {
    topic: 'Job interview',
    practiceMode: 'roleplay',
    scenarioId: 'job-interview',
    difficulty: 'normal',
  });
  const school = getOnboardingRecommendation('academic_language', 'Top Class');
  assert.equal(school.difficulty, 'challenging');
  assert.equal(school.practiceMode, 'custom');
  const immigration = getOnboardingRecommendation('immigration', 'Intermediate');
  assert.equal(immigration.practiceMode, 'custom');
  assert.match(immigration.topic, /appointment|daily life|government/i);
});
