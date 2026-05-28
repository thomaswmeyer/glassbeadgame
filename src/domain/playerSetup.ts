import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  Player,
  SECOND_AI_PLAYER_ID,
} from './game';

export type GamePlayerMode = 'human-vs-ai' | 'ai-vs-ai';

function resolveConfiguredAiModelKey(playerIndex: 1 | 2) {
  const playerSpecificKey = playerIndex === 1
    ? process.env.NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY
    : process.env.NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY;

  return playerSpecificKey ||
    process.env.NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY ||
    'gemini_flash';
}

export function createConfiguredPlayers(playerMode: GamePlayerMode): Player[] {
  if (playerMode === 'ai-vs-ai') {
    return [
      { id: DEFAULT_AI_PLAYER_ID, name: 'AI 1', kind: 'ai', modelKey: resolveConfiguredAiModelKey(1) },
      { id: SECOND_AI_PLAYER_ID, name: 'AI 2', kind: 'ai', modelKey: resolveConfiguredAiModelKey(2) },
    ];
  }

  return [
    { id: DEFAULT_HUMAN_PLAYER_ID, name: 'You', kind: 'local' },
    { id: DEFAULT_AI_PLAYER_ID, name: 'AI', kind: 'ai', modelKey: resolveConfiguredAiModelKey(1) },
  ];
}

export function getPlayerNameAt(players: readonly Player[], index: number, fallback: string) {
  return players[index]?.name || fallback;
}

export function resolveInitialPlayerId(players: readonly Player[] | undefined, useSecondPlayer: boolean) {
  const selectedPlayer = players?.[useSecondPlayer ? 1 : 0];
  if (selectedPlayer) return selectedPlayer.id;

  return useSecondPlayer ? DEFAULT_AI_PLAYER_ID : DEFAULT_HUMAN_PLAYER_ID;
}
