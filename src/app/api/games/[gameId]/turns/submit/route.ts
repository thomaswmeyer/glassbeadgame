import { NextResponse } from 'next/server';
import {
  Difficulty,
  SourceEnvironment,
} from '@/server/game/turnCommitService';
import {
  SubmitTurnValidationError,
  submitTurn,
} from '@/server/game/submitTurnService';
import { evaluateResponse } from '@/services/llm';

export const runtime = 'nodejs';

const DIFFICULTIES = ['secondary', 'undergrad', 'grad', 'unlimited'] as const;

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);
}

function resolveSourceEnvironment(): SourceEnvironment {
  if (process.env.NODE_ENV === 'test') return 'test';
  if (process.env.RENDER === 'true') {
    return process.env.RENDER_SERVICE_TYPE === 'web' ? 'render_prod' : 'render_preview';
  }
  return 'local';
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { gameId } = await context.params;
    const {
      state,
      playerId,
      responseText,
      difficulty,
      selectedSourceNodeIds,
      destinationSubjectCategory,
      fallbackOnEvaluationFailure,
      advanceAfterScoring,
    } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    if (!state || typeof state !== 'object') {
      return NextResponse.json({ error: 'state is required' }, { status: 400 });
    }

    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
    }

    if (!responseText || typeof responseText !== 'string') {
      return NextResponse.json({ error: 'responseText is required' }, { status: 400 });
    }

    if (!isDifficulty(difficulty)) {
      return NextResponse.json({ error: 'difficulty is invalid' }, { status: 400 });
    }

    const result = await submitTurn({
      gameId,
      state,
      playerId,
      responseText,
      difficulty,
      selectedSourceNodeIds,
      destinationSubjectCategory,
      fallbackOnEvaluationFailure,
      advanceAfterScoring,
      sourceEnvironment: resolveSourceEnvironment(),
      services: {
        async evaluateTurn(evaluateRequest) {
          return evaluateResponse(
            evaluateRequest.topic,
            evaluateRequest.response,
            evaluateRequest.difficulty
          );
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error submitting turn:', error);
    const status = error instanceof SubmitTurnValidationError ? 400 : 500;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit turn' },
      { status }
    );
  }
}
