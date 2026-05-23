import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCircleScoreDisplaySections,
  getRegularScoreDisplayItems,
} from '../../src/domain/scoreDisplay';

test('regular score display maps semantic distance and similarity labels', () => {
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
      label: 'Similarity',
      value: 8,
      max: 10,
      description: 'Measures how relevant and appropriate the response is to the topic.',
    },
  ]);
});

test('circle score display exposes current and original topic sections with fallbacks', () => {
  assert.deepEqual(getCircleScoreDisplaySections({
    semanticDistance: 0,
    relevanceQuality: 0,
    total: 14,
    currentConnection: {
      semanticDistance: 7,
      similarity: 8,
      subtotal: 15,
    },
  }), [
    {
      title: 'Current Topic Connection',
      subtotal: 15,
      items: [
        {
          label: 'Semantic Distance',
          value: 7,
          max: 10,
          description: 'Connection quality to the current topic.',
        },
        {
          label: 'Similarity',
          value: 8,
          max: 10,
          description: 'Relevance to the current topic.',
        },
      ],
    },
    {
      title: 'Original Topic Connection',
      subtotal: 0,
      items: [
        {
          label: 'Semantic Distance',
          value: 0,
          max: 10,
          description: 'Connection quality to the original topic.',
        },
        {
          label: 'Similarity',
          value: 0,
          max: 10,
          description: 'Relevance to the original topic.',
        },
      ],
    },
  ]);
});
