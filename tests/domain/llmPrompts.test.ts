import assert from 'node:assert/strict';
import test from 'node:test';
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
