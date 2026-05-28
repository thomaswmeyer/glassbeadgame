import { NextResponse } from 'next/server';
import {
  AdvanceTurnValidationError,
  advancePersistedTurn,
} from '@/server/game/advanceTurnService';
import { SourceEnvironment } from '@/server/game/turnCommitService';

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

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { gameId } = await context.params;

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    const result = advancePersistedTurn({
      gameId,
      sourceEnvironment: resolveSourceEnvironment(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error advancing turn:', error);
    const status = error instanceof AdvanceTurnValidationError ? 400 : 500;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to advance turn' },
      { status }
    );
  }
}
