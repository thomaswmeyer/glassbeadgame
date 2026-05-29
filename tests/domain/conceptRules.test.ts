import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CONCEPT_WORDS,
  countConceptWords,
  validateConceptLength,
} from '../../src/domain/conceptRules';

test('concept length validation accepts concise concepts', () => {
  assert.equal(MAX_CONCEPT_WORDS, 5);
  assert.equal(countConceptWords('Masoretic Text'), 2);
  assert.equal(validateConceptLength('Wave-particle duality').valid, true);
  assert.equal(validateConceptLength('The Borsuk-Ulam Theorem').valid, true);
});

test('concept length validation rejects topics over five words', () => {
  const result = validateConceptLength(
    "The hermeneutic significance of the Masoretic Text's qere/ketiv distinctions"
  );

  assert.equal(result.valid, false);
  assert.equal(result.wordCount, 9);
  assert.match(result.message || '', /5 words or fewer/);
});
