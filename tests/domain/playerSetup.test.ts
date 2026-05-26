import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  SECOND_AI_PLAYER_ID,
} from '../../src/domain/game';
import {
  createConfiguredPlayers,
  getPlayerNameAt,
  resolveInitialPlayerId,
} from '../../src/domain/playerSetup';

test('configured player modes support human-vs-ai and ai-vs-ai games', () => {
  assert.deepEqual(createConfiguredPlayers('human-vs-ai'), [
    { id: DEFAULT_HUMAN_PLAYER_ID, name: 'You', kind: 'local' },
    { id: DEFAULT_AI_PLAYER_ID, name: 'AI', kind: 'ai', modelKey: 'gemini_flash' },
  ]);

  assert.deepEqual(createConfiguredPlayers('ai-vs-ai'), [
    { id: DEFAULT_AI_PLAYER_ID, name: 'AI 1', kind: 'ai', modelKey: 'gemini_flash' },
    { id: SECOND_AI_PLAYER_ID, name: 'AI 2', kind: 'ai', modelKey: 'gemini_flash' },
  ]);
});

test('initial player resolution follows configured player order', () => {
  const aiPlayers = createConfiguredPlayers('ai-vs-ai');

  assert.equal(resolveInitialPlayerId(aiPlayers, false), DEFAULT_AI_PLAYER_ID);
  assert.equal(resolveInitialPlayerId(aiPlayers, true), SECOND_AI_PLAYER_ID);
  assert.equal(resolveInitialPlayerId(undefined, false), DEFAULT_HUMAN_PLAYER_ID);
  assert.equal(resolveInitialPlayerId(undefined, true), DEFAULT_AI_PLAYER_ID);
});

test('setup player labels fall back when a configured player is missing', () => {
  assert.equal(getPlayerNameAt(createConfiguredPlayers('ai-vs-ai'), 1, 'Player 2'), 'AI 2');
  assert.equal(getPlayerNameAt([], 1, 'Player 2'), 'Player 2');
});
