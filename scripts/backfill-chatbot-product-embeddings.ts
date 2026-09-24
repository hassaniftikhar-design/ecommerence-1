import { backfillProductEmbeddingsServer } from '@/server/ai/embeddings/backfill';
import { prisma } from '@/lib/prisma';

async function main() {
  try {
    const result = await backfillProductEmbeddingsServer();
    console.log(`Product embedding backfill complete: ${result.processed} processed, ${result.failed} failed`);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Product embedding backfill failed', error);
  process.exitCode = 1;
});
