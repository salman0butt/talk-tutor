import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProfilePatch,
  isUuid,
  parseFinalTranscriptMessage,
  parseSessionFeedback,
  parseStartSessionInput,
} from '../../lib/learning/validation.ts';

test('profile patch accepts supported learner preferences', () => {
  const value = parseProfilePatch({
    preferredLanguage: 'es-ES',
    proficiencyLevel: 'Intermediate',
    preferredVoice: 'Aoede',
    learningGoal: 'travel',
    dailyPracticeTargetMinutes: 20,
    timezone: 'Asia/Karachi',
  });

  assert.deepEqual(value, {
    preferredLanguage: 'es-ES',
    proficiencyLevel: 'Intermediate',
    preferredVoice: 'Aoede',
    learningGoal: 'travel',
    dailyPracticeTargetMinutes: 20,
    timezone: 'Asia/Karachi',
  });
});

test('profile patch rejects unsupported or unsafe values', () => {
  assert.throws(() => parseProfilePatch({ preferredLanguage: 'xx-XX' }), /language/i);
  assert.throws(() => parseProfilePatch({ proficiencyLevel: 'Expert' }), /proficiency/i);
  assert.throws(() => parseProfilePatch({ learningGoal: 'hack-the-planet' }), /goal/i);
  assert.throws(() => parseProfilePatch({ dailyPracticeTargetMinutes: 0 }), /daily/i);
  assert.throws(() => parseProfilePatch({ timezone: 'Not/AZone' }), /timezone/i);
});

test('profile patch rejects an empty update', () => {
  assert.throws(() => parseProfilePatch({}), /at least one/i);
});

test('UUID validation accepts canonical UUIDs and rejects malformed ids', () => {
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isUuid('../other-user-session'), false);
  assert.equal(isUuid('550e8400e29b41d4a716446655440000'), false);
});

test('final transcript validation accepts finalized non-empty turns only', () => {
  assert.deepEqual(
    parseFinalTranscriptMessage({ role: 'assistant', text: '  Bonjour!  ', sequence: 2, occurredAt: '2026-09-09T12:00:00.000Z' }),
    { role: 'assistant', text: 'Bonjour!', sequence: 2, occurredAt: '2026-09-09T12:00:00.000Z' },
  );
  assert.throws(() => parseFinalTranscriptMessage({ role: 'user', text: '   ', sequence: 1 }), /text/i);
  assert.throws(() => parseFinalTranscriptMessage({ role: 'model', text: 'hello', sequence: 1 }), /role/i);
  assert.throws(() => parseFinalTranscriptMessage({ role: 'user', text: 'hello', sequence: -1 }), /sequence/i);
});

const validFeedback = {
  summary: 'You communicated clearly and kept the conversation moving.',
  grammarCorrections: [{
    original: 'I have went yesterday.',
    corrected: 'I went yesterday.',
    explanation: 'Use the simple past with a completed time expression.',
    category: 'verb_tense',
  }],
  betterSentences: [{
    original: 'Can you say where metro is?',
    suggestion: 'Could you tell me where the metro is?',
    reason: 'This sounds more natural and polite.',
  }],
  vocabulary: [{ term: 'departure', meaning: 'the act of leaving', example: 'What time is the departure?' }],
  fluency: { score: 74, summary: 'Good continuity with a few sentence-form issues.' },
  pronunciationNotes: [],
  nextSteps: ['Practice simple past forms.'],
};

test('structured feedback validation accepts a complete safe payload', () => {
  assert.deepEqual(parseSessionFeedback(validFeedback), validFeedback);
});

test('structured feedback validation rejects malformed or incomplete model output', () => {
  assert.throws(() => parseSessionFeedback({ summary: 'Only summary' }));
  assert.throws(() => parseSessionFeedback({ ...validFeedback, fluency: { score: 140, summary: 'nope' } }), /score/i);
  assert.throws(() => parseSessionFeedback({ ...validFeedback, grammarCorrections: [{ ...validFeedback.grammarCorrections[0], category: 'made_up' }] }), /category/i);
});

test('text-only feedback strips pronunciation claims', () => {
  const parsed = parseSessionFeedback({
    ...validFeedback,
    pronunciationNotes: [{ term: 'departure', note: 'You pronounced this incorrectly.' }],
  });
  assert.deepEqual(parsed.pronunciationNotes, []);
});

test('session start validation requires supported config and a finalized user turn', () => {
  const parsed = parseStartSessionInput({
    language: 'fr-FR',
    proficiencyLevel: 'Intermediate',
    topic: 'Travel & Directions',
    assistantVoice: 'Aoede',
    messages: [
      { role: 'assistant', text: 'Bonjour', sequence: 0, occurredAt: '2026-09-09T10:00:00Z' },
      { role: 'user', text: 'Salut', sequence: 1, occurredAt: '2026-09-09T10:00:02Z' },
    ],
  });
  assert.equal(parsed.messages.length, 2);
  assert.throws(() => parseStartSessionInput({
    language: 'xx-XX', proficiencyLevel: 'Intermediate', topic: 'Travel & Directions', assistantVoice: 'Aoede',
    messages: [{ role: 'user', text: 'Hi', sequence: 0 }],
  }), /language/i);
  assert.throws(() => parseStartSessionInput({
    language: 'fr-FR', proficiencyLevel: 'Intermediate', topic: 'Free Chat', assistantVoice: 'Aoede',
    messages: [{ role: 'assistant', text: 'Hi', sequence: 0 }],
  }), /user message/i);
});


test('profile patch accepts personalized practice defaults', () => {
  assert.deepEqual(
    parseProfilePatch({
      correctionFrequency: 'minimal',
      conversationDifficulty: 'challenging',
    }),
    {
      correctionFrequency: 'minimal',
      conversationDifficulty: 'challenging',
    },
  );
  assert.throws(
    () => parseProfilePatch({ correctionFrequency: 'constant' }),
    /correction/i,
  );
  assert.throws(
    () => parseProfilePatch({ conversationDifficulty: 'impossible' }),
    /difficulty/i,
  );
});

test('session start accepts a safe free-form topic and full personalized practice configuration', () => {
  const parsed = parseStartSessionInput({
    language: 'en-US',
    proficiencyLevel: 'Intermediate',
    topic: '  Software   engineering interview preparation ',
    assistantVoice: 'Aoede',
    practiceMode: 'roleplay',
    scenarioId: 'job-interview',
    customScenario: 'The interviewer asks about a delayed project.',
    learnerRole: 'Candidate',
    tutorRole: 'Hiring manager',
    correctionFrequency: 'frequent',
    difficulty: 'challenging',
    targetMistakeCategories: ['articles', 'verb_tense'],
    messages: [
      { role: 'user', text: 'Tell me about the role.', sequence: 0, occurredAt: '2026-09-09T12:00:00Z' },
    ],
  });

  assert.equal(parsed.topic, 'Software engineering interview preparation');
  assert.equal(parsed.practiceMode, 'roleplay');
  assert.equal(parsed.scenarioId, 'job-interview');
  assert.equal(parsed.correctionFrequency, 'frequent');
  assert.equal(parsed.difficulty, 'challenging');
  assert.deepEqual(parsed.targetMistakeCategories, ['articles', 'verb_tense']);
});
