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

function withPlayerModelEnv(callback: () => void) {
  const previousPlayer1 = process.env.NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY;
  const previousPlayer2 = process.env.NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY;
  const previousDefault = process.env.NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY;

  delete process.env.NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY;
  delete process.env.NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY;
  delete process.env.NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY;

  try {
    callback();
  } finally {
    if (previousPlayer1 === undefined) {
      delete process.env.NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY;
    } else {
      process.env.NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY = previousPlayer1;
    }

    if (previousPlayer2 === undefined) {
      delete process.env.NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY;
    } else {
      process.env.NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY = previousPlayer2;
    }

    if (previousDefault === undefined) {
      delete process.env.NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY;
    } else {
      process.env.NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY = previousDefault;
    }
  }
}

test('configured player modes support human-vs-ai and ai-vs-ai games', () => {
  withPlayerModelEnv(() => {
    assert.deepEqual(createConfiguredPlayers('human-vs-ai'), [
      { id: DEFAULT_HUMAN_PLAYER_ID, name: 'You', kind: 'local' },
      { id: DEFAULT_AI_PLAYER_ID, name: 'AI', kind: 'ai', modelKey: 'gemini_flash' },
    ]);

    assert.deepEqual(createConfiguredPlayers('ai-vs-ai'), [
      { id: DEFAULT_AI_PLAYER_ID, name: 'AI 1', kind: 'ai', modelKey: 'gemini_flash' },
      { id: SECOND_AI_PLAYER_ID, name: 'AI 2', kind: 'ai', modelKey: 'gemini_flash' },
    ]);
  });
});

test('configured AI players can use independent public model keys', () => {
  withPlayerModelEnv(() => {
    process.env.NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY = 'gemini_pro';
    process.env.NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY = 'claude_sonnet';

    assert.deepEqual(createConfiguredPlayers('ai-vs-ai'), [
      { id: DEFAULT_AI_PLAYER_ID, name: 'AI 1', kind: 'ai', modelKey: 'gemini_pro' },
      { id: SECOND_AI_PLAYER_ID, name: 'AI 2', kind: 'ai', modelKey: 'claude_sonnet' },
    ]);
  });
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
