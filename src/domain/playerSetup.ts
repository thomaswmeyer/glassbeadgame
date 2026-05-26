import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  Player,
  SECOND_AI_PLAYER_ID,
} from './game';

export type GamePlayerMode = 'human-vs-ai' | 'ai-vs-ai';

export function createConfiguredPlayers(playerMode: GamePlayerMode): Player[] {
  if (playerMode === 'ai-vs-ai') {
    return [
      { id: DEFAULT_AI_PLAYER_ID, name: 'AI 1', kind: 'ai', modelKey: 'gemini_flash' },
      { id: SECOND_AI_PLAYER_ID, name: 'AI 2', kind: 'ai', modelKey: 'gemini_flash' },
    ];
  }

  return [
    { id: DEFAULT_HUMAN_PLAYER_ID, name: 'You', kind: 'local' },
    { id: DEFAULT_AI_PLAYER_ID, name: 'AI', kind: 'ai', modelKey: 'gemini_flash' },
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
