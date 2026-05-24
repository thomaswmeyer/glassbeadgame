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

test('definition prompt asks for concise complete definitions only', () => {
  const prompt = buildDefinitionPrompt('Counterpoint');

  assert.match(prompt.systemPrompt, /1-2 complete sentences/);
  assert.match(prompt.systemPrompt, /no more than 80 words/);
  assert.equal(prompt.userMessage, 'Please provide a concise definition for: "Counterpoint"');
});

test('ai response prompt switches to final-round circle instructions when needed', () => {
  const prompt = buildAiResponsePrompt({
    topic: 'Fugue',
    originalTopic: 'Cathedral',
    gameHistory: [{ topic: 'Root', response: 'Echo', player: 'ai' }],
    difficulty: 'undergrad',
    circleEnabled: true,
    isFinalRound: true,
    timestamp: 'seed',
  });

  assert.match(prompt.systemPrompt, /FINAL ROUND/);
  assert.match(prompt.systemPrompt, /Cathedral/);
  assert.match(prompt.systemPrompt, /Avoid these previously used responses: Echo/);
  assert.match(prompt.userMessage, /connects to BOTH/);
});

test('evaluation prompt uses final-round JSON schema only when original topic is present', () => {
  const regular = buildEvaluationPrompt({
    topic: 'Fugue',
    response: 'Lattice',
    difficulty: 'undergrad',
  });
  const final = buildEvaluationPrompt({
    topic: 'Fugue',
    response: 'Lattice',
    difficulty: 'undergrad',
    originalTopic: 'Cathedral',
    isFinalRound: true,
  });

  assert.doesNotMatch(regular.systemPrompt, /finalEvaluation/);
  assert.match(final.systemPrompt, /finalEvaluation/);
  assert.match(final.userMessage, /Cathedral/);
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
