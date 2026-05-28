import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiResponsePrompt, buildGenerateTopicPrompt } from '../../src/domain/llmPrompts';
import { scoringCalibrationExamples } from '../../src/domain/scoringCalibration';

test('scoring calibration examples cover low and high values on both axes', () => {
  const distances = scoringCalibrationExamples.map(example => example.semanticDistance);
  const relevances = scoringCalibrationExamples.map(example => example.relevance);

  assert.ok(distances.some(score => score <= 2));
  assert.ok(distances.some(score => score >= 9));
  assert.ok(relevances.some(score => score <= 2));
  assert.ok(relevances.some(score => score >= 9));
  assert.ok(scoringCalibrationExamples.length >= 10);
});

test('topic generation prompt requests a structured topic-only response', () => {
  const prompt = buildGenerateTopicPrompt({
    category: 'scientific concept',
    subcategory: 'physics',
    difficulty: 'undergrad',
    recentTopics: ['Resonance'],
    timestamp: '2026-05-28T00:00:00.000Z',
  });

  assert.match(prompt.systemPrompt, /Return only valid JSON/);
  assert.match(prompt.systemPrompt, /"topic": "single topic name"/);
  assert.match(prompt.systemPrompt, /Do not include explanations/);
  assert.match(prompt.userMessage, /Return only JSON/);
});

test('free AI response prompt asks the model to choose the highest expected penalized score', () => {
  const prompt = buildAiResponsePrompt({
    topic: 'Ignored current topic',
    availableNodes: [
      { id: 'root', topic: 'Apophenia' },
      { id: 'node-1', topic: 'Augury' },
      { id: 'node-2', topic: 'Pareidolia' },
    ],
    selectedSourceNodeIds: [],
    sourceSelectionMode: 'free',
    gameHistory: [],
    difficulty: 'undergrad',
    timestamp: '2026-05-28T00:00:00.000Z',
  });

  assert.match(prompt.systemPrompt, /Do not default to the most recent node/);
  assert.match(prompt.systemPrompt, /highest final score/);
  assert.match(prompt.systemPrompt, /single excellent edge is often better/);
  assert.match(prompt.systemPrompt, /round\(sum\(edgeScores\) \/ sqrt\(N\)\)/);
  assert.match(prompt.userMessage, /No source node is preselected/);
  assert.match(prompt.userMessage, /Compare one-source, two-source, and three-source options/);
  assert.match(prompt.userMessage, /use multiple sources only when the penalized combined score is likely higher/);
});
