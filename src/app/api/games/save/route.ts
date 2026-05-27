import { NextResponse } from 'next/server';
import { saveGameSnapshot } from '@/server/persistence/gameSnapshotRepository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { gameId, state } = await request.json();

    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    if (!state || typeof state !== 'object') {
      return NextResponse.json({ error: 'state is required' }, { status: 400 });
    }

    saveGameSnapshot({
      gameId,
      state,
      sourceEnvironment: process.env.NODE_ENV === 'test' ? 'test' : 'local',
    });

    return NextResponse.json({ gameId });
  } catch (error) {
    console.error('Error saving game snapshot:', error);
    return NextResponse.json({ error: 'Failed to save game snapshot' }, { status: 500 });
  }
}
