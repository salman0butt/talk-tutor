import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVocabularyTerm,
  deduplicateVocabularyCandidates,
  parseVocabularyExample,
} from '../../lib/learning/vocabulary.ts';

test('vocabulary normalization uses NFKC, whitespace collapse and case folding', () => {
  assert.equal(normalizeVocabularyTerm('  Ｄｅｐａｒｔｕｒｅ   Gate  '), 'departure gate');
});

test('candidate deduplication keeps the first meaningful metadata per normalized language term', () => {
  const result = deduplicateVocabularyCandidates([
    { term: 'Departure', language: 'en-US', meaning: 'the act of leaving' },
    { term: ' departure ', language: 'en-US', meaning: 'duplicate' },
    { term: 'Departure', language: 'en-GB', meaning: 'British deck' },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].normalizedTerm, 'departure');
  assert.equal(result[0].meaning, 'the act of leaving');
});

test('personalized example validation accepts bounded structured output and rejects invalid category', () => {
  assert.deepEqual(parseVocabularyExample({
    sentence: 'I went to the office because we had an important deadline.',
    explanation: 'Uses the simple past correctly.',
    targetMistakeCategory: 'verb_tense',
  }), {
    sentence: 'I went to the office because we had an important deadline.',
    explanation: 'Uses the simple past correctly.',
    targetMistakeCategory: 'verb_tense',
  });
  assert.throws(() => parseVocabularyExample({
    sentence: 'Example',
    targetMistakeCategory: 'invented',
  }), /category/i);
});
