import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAiResponsePrompt,
  buildDefinitionPrompt,
  buildEvaluationPrompt,
  buildGenerateTopicPrompt,
} from '../../src/domain/llmPrompts';
import { scoringCalibrationExamples } from '../../src/domain/scoringCalibration';

test('topic prompt includes difficulty, category context, recent exclusions, and timestamp seed', () => {
  const prompt = buildGenerateTopicPrompt({
    category: 'Science',
    subcategory: 'Physics',
    difficulty: 'secondary',
    recentTopics: ['Gravity'],
    timestamp: '2026-05-23T00:00:00.000Z',
  });

  assert.match(prompt.systemPrompt, /high school students/);
  assert.match(prompt.systemPrompt, /category: Science/);
  assert.match(prompt.systemPrompt, /Avoid these recently used topics: Gravity/);
  assert.match(prompt.systemPrompt, /2026-05-23T00:00:00.000Z/);
  assert.match(prompt.userMessage, /Physics/);
});

test('secondary topic prompt excludes advanced named theorem seed concepts', () => {
  const prompt = buildGenerateTopicPrompt({
    category: 'Mathematics',
    subcategory: 'Topology',
    difficulty: 'secondary',
    recentTopics: [],
    timestamp: '2026-05-23T00:00:00.000Z',
  });

  assert.match(prompt.systemPrompt, /Do not use named theorems/);
  assert.match(prompt.systemPrompt, /graduate mathematics/);
  assert.match(prompt.systemPrompt, /research-level ideas/);
  assert.match(prompt.systemPrompt, /symmetry, fractions, probability, triangles, graphs, prime numbers, or ratios/);
  assert.doesNotMatch(prompt.systemPrompt, /Borsuk-Ulam/);
});

test('definition prompt asks for concise complete definitions only', () => {
  const prompt = buildDefinitionPrompt('Counterpoint');

  assert.match(prompt.systemPrompt, /1-2 complete sentences/);
  assert.match(prompt.systemPrompt, /no more than 80 words/);
  assert.equal(prompt.userMessage, 'Please provide a concise definition for: "Counterpoint"');
});

test('ai response prompt describes source selection and multi-source scoring', () => {
  const prompt = buildAiResponsePrompt({
    topic: 'Fugue',
    availableNodes: [
      { id: 'root', topic: 'Cathedral', isCurrentSource: false },
      { id: 'node-1', topic: 'Fugue', isCurrentSource: true },
    ],
    selectedSourceNodeIds: ['node-1'],
    gameHistory: [{ topic: 'Root', response: 'Echo', player: 'ai' }],
    difficulty: 'undergrad',
    timestamp: 'seed',
  });

  assert.doesNotMatch(prompt.systemPrompt, /FINAL ROUND/);
  assert.match(prompt.systemPrompt, /selectedSourceNodeIds/);
  assert.match(prompt.systemPrompt, /sum\(edgeScores\) \/ sqrt\(N\)/);
  assert.match(prompt.systemPrompt, /Avoid these previously used responses: Echo/);
  assert.match(prompt.userMessage, /id: node-1; topic: "Fugue"; currently selected/);
  assert.match(prompt.userMessage, /choose source nodes and provide your brief response/);
});

test('free ai source selection prompt does not suggest the current UI selection', () => {
  const prompt = buildAiResponsePrompt({
    topic: 'Fugue',
    availableNodes: [
      { id: 'root', topic: 'Cathedral', isCurrentSource: false },
      { id: 'node-1', topic: 'Fugue', isCurrentSource: true },
    ],
    selectedSourceNodeIds: ['node-1'],
    sourceSelectionMode: 'free',
    gameHistory: [],
    difficulty: 'undergrad',
    timestamp: 'seed',
  });

  assert.match(prompt.userMessage, /There is no required current topic/);
  assert.match(prompt.userMessage, /No source node is preselected for you/);
  assert.doesNotMatch(prompt.userMessage, /currently selected/);
});

test('evaluation prompt uses the regular graph-edge JSON schema', () => {
  const prompt = buildEvaluationPrompt({
    topic: 'Fugue',
    response: 'Lattice',
    difficulty: 'undergrad',
  });

  assert.doesNotMatch(prompt.systemPrompt, /finalEvaluation/);
  assert.match(prompt.systemPrompt, /destinationSubjectCategory/);
  assert.match(prompt.systemPrompt, /mathematics \(Mathematics\)/);
  assert.match(prompt.systemPrompt, /"semanticDistance": X/);
  assert.match(prompt.systemPrompt, /"relevanceQuality": Y/);
});

test('evaluation prompt includes calibration anchors for scoring dynamic range', () => {
  const prompt = buildEvaluationPrompt({
    topic: 'Fugue',
    response: 'Lattice',
    difficulty: 'undergrad',
  });

  assert.match(prompt.systemPrompt, /Use the full 1-10 range/);
  assert.match(prompt.systemPrompt, /chords" -> "harmony": semanticDistance 1, relevance 10/);
  assert.match(prompt.systemPrompt, /fish" -> "relativity": semanticDistance 10, relevance 1/);
  assert.match(prompt.systemPrompt, /semantic distance and relevance as independent axes/);
});

test('scoring calibration examples cover low and high values on both axes', () => {
  const distances = scoringCalibrationExamples.map(example => example.semanticDistance);
  const relevances = scoringCalibrationExamples.map(example => example.relevance);

  assert.ok(distances.some(score => score <= 2));
  assert.ok(distances.some(score => score >= 9));
  assert.ok(relevances.some(score => score <= 2));
  assert.ok(relevances.some(score => score >= 9));
  assert.ok(scoringCalibrationExamples.length >= 10);
});
