import { NextResponse } from 'next/server';
import {
  SourceEnvironment,
} from '@/server/game/turnCommitService';
import {
  SubmitTurnValidationError,
  submitTurn,
} from '@/server/game/submitTurnService';
import { loadGameSnapshot } from '@/server/persistence/gameSnapshotRepository';
import { evaluateResponse } from '@/services/llm';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

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
      playerId,
      responseText,
      selectedSourceNodeIds,
      destinationSubjectCategory,
      fallbackOnEvaluationFailure,
      advanceAfterScoring,
    } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
    }

    if (!responseText || typeof responseText !== 'string') {
      return NextResponse.json({ error: 'responseText is required' }, { status: 400 });
    }

    const snapshot = loadGameSnapshot(gameId);
    if (!snapshot) {
      return NextResponse.json({ error: 'game not found' }, { status: 404 });
    }

    const result = await submitTurn({
      gameId,
      state: snapshot.state,
      playerId,
      responseText,
      difficulty: snapshot.difficulty,
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
