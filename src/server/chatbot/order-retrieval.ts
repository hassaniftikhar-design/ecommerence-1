import 'server-only';

import { prisma } from '@/lib/prisma';
import { embedQuery } from '@/server/ai/embeddings';
import {
  getMyOrdersByIdsForChatServer,
  getMyOrdersForChatServer,
  searchMyOrdersForChatServer
} from '@/server/services/order.service';

export async function getMyOrdersServer(userId: string, limit = 10) {
  return getMyOrdersForChatServer(userId, limit);
}

export async function searchMyOrdersServer(userId: string, query: string) {
  const lexical = await searchMyOrdersForChatServer(userId, query);
  if (lexical.length || /^\d{4,}$/.test(query.trim())) return lexical;

  try {
    const vector = await embedQuery(query.trim().slice(0, 200));
    const vectorLiteral = `[${vector.map((value) => value.toFixed(8)).join(',')}]`;
    const semantic = await prisma.$queryRaw<Array<{ orderId: string }>>`
      SELECT o."id" AS "orderId"
      FROM "EmbeddingDocument" ed
      INNER JOIN "Order" o
        ON o."id" = ed."entityId" AND o."userId" = ${userId}
      WHERE ed."entityType" = 'ORDER'
        AND ed."userId" = ${userId}
        AND ed."status" = 'ACTIVE'
      ORDER BY ed."embedding" <=> ${vectorLiteral}::vector
      LIMIT 5
    `;
    return getMyOrdersByIdsForChatServer(userId, semantic.map(({ orderId }) => orderId));
  } catch (error) {
    console.error('[ShopFast Assistant] Semantic order retrieval unavailable', error);
    return [];
  }
}
