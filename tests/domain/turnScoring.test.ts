import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateEdgeTotalScore,
  combineSourceScores,
  formatCombinedEvaluation,
  normalizeScore,
  type SourceTurnEvaluation,
} from '../../src/domain/turnScoring';

test('edge score multiplies semantic distance and relevance', () => {
  assert.equal(calculateEdgeTotalScore({
    semanticDistance: 7,
    relevanceQuality: 8,
  }), 56);
});

test('normalizes regular LLM scores to multiplicative totals', () => {
  assert.deepEqual(normalizeScore({
    semanticDistance: 6,
    relevanceQuality: 7,
    total: 13,
  }), {
    semanticDistance: 6,
    relevanceQuality: 7,
    total: 42,
  });
});

test('normalizes final-round connection subtotals to multiplicative totals', () => {
  assert.deepEqual(normalizeScore({
    semanticDistance: 0,
    relevanceQuality: 0,
    total: 15,
    currentConnection: {
      semanticDistance: 7,
      relevance: 8,
      subtotal: 15,
    },
    originalConnection: {
      semanticDistance: 6,
      relevance: 8,
      subtotal: 14,
    },
  }), {
    semanticDistance: 0,
    relevanceQuality: 0,
    total: 52,
    currentConnection: {
      semanticDistance: 7,
      relevance: 8,
      subtotal: 56,
    },
    originalConnection: {
      semanticDistance: 6,
      relevance: 8,
      subtotal: 48,
    },
  });
});

test('combines multi-source scores with square-root diminishing returns', () => {
  assert.deepEqual(combineSourceScores([
    { semanticDistance: 7, relevanceQuality: 8, total: 15 },
    { semanticDistance: 6, relevanceQuality: 7, total: 13 },
  ]), {
    semanticDistance: 7,
    relevanceQuality: 8,
    total: 69,
  });
});

test('combined evaluation names each source when a turn has multiple edges', () => {
  const evaluations: SourceTurnEvaluation[] = [
    {
      sourceNodeId: 'root',
      sourceTopic: 'Cathedrals',
      evaluation: 'Strong architectural mapping.',
      scores: { semanticDistance: 7, relevanceQuality: 8, total: 56 },
    },
    {
      sourceNodeId: 'node-1',
      sourceTopic: 'Flying buttresses',
      evaluation: 'Good structural continuity.',
      scores: { semanticDistance: 6, relevanceQuality: 7, total: 42 },
    },
  ];

  assert.equal(
    formatCombinedEvaluation(evaluations),
    'Connection to "Cathedrals":\nStrong architectural mapping.\n\n' +
      'Connection to "Flying buttresses":\nGood structural continuity.'
  );
});
