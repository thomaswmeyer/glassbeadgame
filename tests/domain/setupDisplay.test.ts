import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DIFFICULTY_LEVELS,
  DEFAULT_ROUND_OPTIONS,
  difficultyDescriptions,
  formatDifficultyLabel,
  getTurnsEachLabel,
} from '../../src/domain/setupDisplay';

test('setup display exposes the supported round and difficulty choices in UI order', () => {
  assert.deepEqual([...DEFAULT_ROUND_OPTIONS], [4, 6, 8, 10, 12, 14, 16, 20]);
  assert.deepEqual(DEFAULT_DIFFICULTY_LEVELS, ['secondary', 'undergrad', 'grad', 'unlimited']);
});

test('setup display formats difficulty labels and descriptions', () => {
  assert.equal(formatDifficultyLabel('secondary'), 'Secondary');
  assert.equal(formatDifficultyLabel('undergrad'), 'Undergrad');
  assert.equal(difficultyDescriptions.grad, 'Specialized graduate-level concepts');
});

test('setup display rounds odd max rounds up for the turns-each label', () => {
  assert.equal(getTurnsEachLabel(10), '5 turns each');
  assert.equal(getTurnsEachLabel(9), '5 turns each');
});
