import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSubmitTurnResponse,
  getTurnResponseValidationMessage,
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

  assert.equal(getTurnResponsePanelTitle({
    isCurrentPlayerManual: true,
    isOpeningTurn: true,
    playerName: 'OpenClaw',
  }), 'Choose Opening Topic:');

  assert.equal(getTurnResponsePanelTitle({
    isCurrentPlayerManual: false,
    isOpeningTurn: true,
    playerName: 'OpenClaw',
  }), 'OpenClaw is choosing the opening topic...');
});

test('turn response placeholder switches for opening turns', () => {
  assert.equal(
    getTurnResponsePlaceholder({}),
    'Type a brief response (1-5 words) and press Enter...'
  );

  assert.equal(
    getTurnResponsePlaceholder({ isOpeningTurn: true }),
    'Choose the opening topic for this game and press Enter...'
  );
});

test('turn response submit state requires non-empty text and no active evaluation', () => {
  assert.equal(canSubmitTurnResponse({ response: '  ', isEvaluating: false }), false);
  assert.equal(canSubmitTurnResponse({ response: 'Fugue', isEvaluating: true }), false);
  assert.equal(canSubmitTurnResponse({ response: 'Fugue', isEvaluating: false }), true);
  assert.equal(canSubmitTurnResponse({
    response: 'The hermeneutic significance of textual criticism',
    isEvaluating: false,
  }), false);
  assert.match(
    getTurnResponseValidationMessage('The hermeneutic significance of textual criticism'),
    /5 words or fewer/
  );
});
