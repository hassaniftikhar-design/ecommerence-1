import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getEmbeddingModelStatus } from '@/server/ai/embeddings';
import { isGroqConfigured } from '@/server/chatbot/groq';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database: 'ready' | 'unavailable' = 'unavailable';
  let pgvector: 'ready' | 'unavailable' = 'unavailable';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'ready';
    const extension = await prisma.$queryRaw<Array<{ installed: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed
    `;
    pgvector = extension[0]?.installed ? 'ready' : 'unavailable';
  } catch {
    // Report state only; connection details and driver errors stay in server logs.
  }

  const embedding = getEmbeddingModelStatus();
  const groq = isGroqConfigured() ? 'configured' : 'unavailable';
  const ready = database === 'ready' && pgvector === 'ready' && embedding === 'ready' && groq === 'configured';

  return NextResponse.json({
    status: ready ? 'healthy' : 'degraded',
    embeddingModel: embedding,
    database,
    pgvector,
    groq
  }, { status: ready ? 200 : 503 });
}
