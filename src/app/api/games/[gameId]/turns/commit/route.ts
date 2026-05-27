import { NextResponse } from 'next/server';
import {
  CommittedTurnValidationError,
  commitCompletedTurn,
} from '@/server/game/turnCommitService';

export const runtime = 'nodejs';

const DIFFICULTIES = ['secondary', 'undergrad', 'grad', 'unlimited'] as const;
type Difficulty = typeof DIFFICULTIES[number];

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { gameId } = await context.params;
    const { state, turnId, difficulty } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    if (!turnId || typeof turnId !== 'string') {
      return NextResponse.json({ error: 'turnId is required' }, { status: 400 });
    }

    if (!state || typeof state !== 'object') {
      return NextResponse.json({ error: 'state is required' }, { status: 400 });
    }

    if (difficulty !== undefined && !isDifficulty(difficulty)) {
      return NextResponse.json({ error: 'difficulty is invalid' }, { status: 400 });
    }

    commitCompletedTurn({
      gameId,
      state,
      turnId,
      difficulty: difficulty ?? 'undergrad',
      sourceEnvironment: process.env.NODE_ENV === 'test' ? 'test' : 'local',
    });

    return NextResponse.json({ gameId, turnId });
  } catch (error) {
    console.error('Error committing completed turn:', error);
    const status = error instanceof CommittedTurnValidationError ? 400 : 500;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to commit completed turn' },
      { status }
    );
  }
}
