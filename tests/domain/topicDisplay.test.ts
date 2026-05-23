import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDefinitionButtonLabel,
  getRoundBadgeText,
} from '../../src/domain/topicDisplay';

test('definition button label reflects loading and visibility state', () => {
  assert.equal(getDefinitionButtonLabel({
    isLoading: true,
    isDefinitionVisible: false,
  }), 'Loading...');

  assert.equal(getDefinitionButtonLabel({
    isLoading: false,
    isDefinitionVisible: true,
  }), 'Hide Definition');

  assert.equal(getDefinitionButtonLabel({
    isLoading: false,
    isDefinitionVisible: false,
  }), 'Definition');

  assert.equal(getDefinitionButtonLabel({
    isLoading: false,
    isDefinitionVisible: false,
    hiddenLabel: 'Original Topic Definition',
  }), 'Original Topic Definition');
});

test('round badge text describes starting and final rounds', () => {
  assert.equal(getRoundBadgeText({
    currentRound: 1,
    maxRounds: 6,
    circleEnabled: false,
    originalTopic: 'Fugue',
  }), 'Starting Topic');

  assert.equal(getRoundBadgeText({
    currentRound: 3,
    maxRounds: 6,
    circleEnabled: false,
    originalTopic: 'Fugue',
  }), null);

  assert.equal(getRoundBadgeText({
    currentRound: 6,
    maxRounds: 6,
    circleEnabled: false,
    originalTopic: 'Fugue',
  }), 'Final Round');

  assert.equal(getRoundBadgeText({
    currentRound: 6,
    maxRounds: 6,
    circleEnabled: true,
    originalTopic: 'Fugue',
  }), 'Final Round - Connect back to "Fugue"');
});

