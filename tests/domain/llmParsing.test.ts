import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fallbackEvaluationResponse,
  parseEvaluationResponse,
  trimIncompleteTrailingSentence,
} from '../../src/domain/llmParsing';

test('definition trimming preserves complete definitions and closes short fragments', () => {
  assert.equal(trimIncompleteTrailingSentence('A complete definition.'), 'A complete definition.');
  assert.equal(trimIncompleteTrailingSentence('An incomplete definition'), 'An incomplete definition.');
});

test('definition trimming removes long incomplete trailing sentences', () => {
  assert.equal(
    trimIncompleteTrailingSentence(
      'This is a complete sentence with enough context to keep. This trails off without finishing the thought'
    ),
    'This is a complete sentence with enough context to keep.'
  );
});

test('evaluation parser accepts direct JSON responses', () => {
  const parsed = parseEvaluationResponse(JSON.stringify({
    evaluation: 'Strong connection.',
    scores: {
      semanticDistance: 7,
      relevanceQuality: 8,
      total: 15,
    },
  }));

  assert.equal(parsed.evaluation, 'Strong connection.');
  assert.equal(parsed.scores.total, 15);
});

test('evaluation parser extracts JSON from wrapped model text', () => {
  const parsed = parseEvaluationResponse(`Here is the JSON:
  {
    "evaluation": "Works.",
    "scores": { "semanticDistance": 6, "relevanceQuality": 7, "total": 13 }
  }
  Thanks.`);

  assert.equal(parsed.evaluation, 'Works.');
  assert.equal(parsed.scores.total, 13);
});

test('evaluation parser repairs common loose JSON before falling back', () => {
  const parsed = parseEvaluationResponse(`{
    evaluation: 'Loose but readable',
    scores: { semanticDistance: 5, relevanceQuality: 6, total: 11 }
  }`);

  assert.equal(parsed.evaluation, 'Loose but readable');
  assert.equal(parsed.scores.total, 11);
});

test('evaluation parser returns final-round fallback shape on invalid final JSON', () => {
  const parsed = parseEvaluationResponse('not json', { isFinalRound: true });
  const fallback = fallbackEvaluationResponse(true);

  assert.deepEqual(parsed, fallback);
  assert.equal(parsed.finalEvaluation, 'Error parsing the evaluation.');
  assert.equal(parsed.scores.currentConnection?.subtotal, 10);
});
