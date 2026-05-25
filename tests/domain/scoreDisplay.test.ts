import assert from 'node:assert/strict';
import test from 'node:test';
import { getRegularScoreDisplayItems } from '../../src/domain/scoreDisplay';

test('regular score display maps semantic distance and relevance labels', () => {
  assert.deepEqual(getRegularScoreDisplayItems({
    semanticDistance: 7,
    relevanceQuality: 8,
    total: 15,
  }), [
    {
      label: 'Semantic Distance',
      value: 7,
      max: 10,
      description: 'Measures how well the concepts are connected intellectually.',
    },
    {
      label: 'Relevance',
      value: 8,
      max: 10,
      description: 'Measures how relevant and appropriate the response is to the topic.',
    },
  ]);
});
