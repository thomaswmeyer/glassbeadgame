import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fallbackEvaluationResponse,
  parseAiMoveResponse,
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
    destinationSubjectCategory: 'Mathematics',
    scores: {
      semanticDistance: 7,
      relevanceQuality: 8,
      total: 15,
    },
  }));

  assert.equal(parsed.evaluation, 'Strong connection.');
  assert.equal(parsed.destinationSubjectCategory, 'mathematics');
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

test('evaluation parser returns regular fallback shape on invalid JSON', () => {
  const parsed = parseEvaluationResponse('not json');
  const fallback = fallbackEvaluationResponse();

  assert.deepEqual(parsed, fallback);
  assert.equal(parsed.scores.total, 25);
});

test('ai move parser accepts selected sources and response topic JSON', () => {
  assert.deepEqual(parseAiMoveResponse(JSON.stringify({
    selectedSourceNodeIds: ['root', 'node-1'],
    responseText: 'Rosetta Stone',
  })), {
    selectedSourceNodeIds: ['root', 'node-1'],
    responseText: 'Rosetta Stone',
  });

  assert.deepEqual(parseAiMoveResponse(`Move:
  { "selectedSourceNodeIds": ["root"], "destinationTopic": "Chorus" }
  `), {
    selectedSourceNodeIds: ['root'],
    responseText: 'Chorus',
  });
});

test('ai move parser preserves multi-source choices with common source id aliases', () => {
  assert.deepEqual(parseAiMoveResponse(JSON.stringify({
    sourceNodeIds: ['root', 'node-1', 42, 'node-2'],
    topic: 'Resonance',
  })), {
    selectedSourceNodeIds: ['root', 'node-1', 'node-2'],
    responseText: 'Resonance',
  });

  assert.deepEqual(parseAiMoveResponse(JSON.stringify({
    selectedSources: ['root', 'node-3'],
    destinationTopic: 'Counterpoint',
  })), {
    selectedSourceNodeIds: ['root', 'node-3'],
    responseText: 'Counterpoint',
  });
});
