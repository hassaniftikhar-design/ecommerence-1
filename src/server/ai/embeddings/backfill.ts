import 'server-only';

import { prisma } from '@/lib/prisma';

import { syncProductEmbeddingServer } from './product';

export async function backfillProductEmbeddingsServer(batchSize = 25) {
  const pageSize = Math.max(1, Math.min(100, Math.floor(batchSize)));
  let cursor: string | undefined;
  let processed = 0;
  let failed = 0;

  while (true) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    if (products.length === 0) break;

    for (const product of products) {
      try {
        await syncProductEmbeddingServer(product.id);
        processed += 1;
      } catch (error) {
        failed += 1;
        console.error(`[ShopFast Assistant] Product embedding backfill failed for ${product.id}`, error);
      }
    }

    cursor = products[products.length - 1]?.id;
    if (products.length < pageSize) break;
  }

  return { processed, failed };
}
