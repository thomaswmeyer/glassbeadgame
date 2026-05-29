import { NextResponse } from 'next/server';
import {
  Player,
  createEmptyGameState,
  setGameStatus,
} from '@/domain/game';
import { Difficulty } from '@/server/game/turnCommitService';
import { saveGameSnapshot } from '@/server/persistence/gameSnapshotRepository';

export const runtime = 'nodejs';

const DIFFICULTIES = ['secondary', 'undergrad', 'grad', 'unlimited'] as const;

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);
}

function isPlayer(value: unknown): value is Player {
  if (typeof value !== 'object' || value === null) return false;

  const player = value as Partial<Player>;
  return typeof player.id === 'string' &&
    typeof player.name === 'string' &&
    (player.kind === 'local' || player.kind === 'ai');
}

export async function POST(request: Request) {
  try {
    const {
      gameId,
      maxRounds,
      initialPlayerId,
      players,
      difficulty,
    } = await request.json();

    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    if (!Number.isInteger(maxRounds) || maxRounds <= 0) {
      return NextResponse.json({ error: 'maxRounds must be a positive integer' }, { status: 400 });
    }

    if (!initialPlayerId || typeof initialPlayerId !== 'string') {
      return NextResponse.json({ error: 'initialPlayerId is required' }, { status: 400 });
    }

    if (!isDifficulty(difficulty)) {
      return NextResponse.json({ error: 'difficulty is invalid' }, { status: 400 });
    }

    if (players !== undefined && (!Array.isArray(players) || !players.every(isPlayer))) {
      return NextResponse.json({ error: 'players is invalid' }, { status: 400 });
    }

    const state = setGameStatus(
      createEmptyGameState(maxRounds, initialPlayerId, players),
      'awaitingResponse'
    );
    await saveGameSnapshot({
      gameId,
      state,
      difficulty,
      sourceEnvironment: process.env.NODE_ENV === 'test' ? 'test' : 'local',
    });

    return NextResponse.json({ gameId, state });
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create game' },
      { status: 500 }
    );
  }
}
