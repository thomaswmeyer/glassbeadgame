import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSubmitTurnResponse,
  getTurnResponsePanelTitle,
  getTurnResponsePlaceholder,
} from '../../src/domain/turnPrompt';

test('turn response title switches between manual and automatic player labels', () => {
  assert.equal(getTurnResponsePanelTitle({
    isCurrentPlayerManual: true,
    playerName: 'OpenClaw',
  }), 'Your Response:');

  assert.equal(getTurnResponsePanelTitle({
    isCurrentPlayerManual: false,
    playerName: 'OpenClaw',
  }), 'OpenClaw is thinking...');

  assert.equal(getTurnResponsePanelTitle({
    isCurrentPlayerManual: false,
  }), 'Player is thinking...');
});

test('turn response placeholder includes circle-round context only for final circle rounds', () => {
  assert.equal(getTurnResponsePlaceholder({
    isFinalCircleRound: false,
    currentSourceTopicText: 'Cathedrals',
    originalTopic: 'Fugue',
  }), 'Type a brief response (1-5 words) and press Enter...');

  assert.equal(getTurnResponsePlaceholder({
    isFinalCircleRound: true,
    currentSourceTopicText: 'Cathedrals',
    originalTopic: 'Fugue',
  }), 'Type a brief response (1-5 words) that connects to both "Cathedrals" and "Fugue"...');
});

test('turn response submit state requires non-empty text and no active evaluation', () => {
  assert.equal(canSubmitTurnResponse({ response: '  ', isEvaluating: false }), false);
  assert.equal(canSubmitTurnResponse({ response: 'Fugue', isEvaluating: true }), false);
  assert.equal(canSubmitTurnResponse({ response: 'Fugue', isEvaluating: false }), true);
});

