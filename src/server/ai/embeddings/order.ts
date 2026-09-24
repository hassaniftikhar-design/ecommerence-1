import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { CHATBOT_EMBEDDING } from '@/constants/chatbot';

import { embedDocument } from './service';

type OrderEmbeddingSource = {
  id: string;
  userId: string;
  orderNumber: string;
  createdAt: Date;
  items: Array<{ title: string; quantity: number }>;
};

export function buildOrderEmbeddingText(order: OrderEmbeddingSource): string {
  const products = order.items
    .map((item) => `${item.title.trim()} (quantity: ${item.quantity})`)
    .sort((a, b) => a.localeCompare(b));

  return [
    `Order: ${order.orderNumber}`,
    `Order Date: ${order.createdAt.toISOString().slice(0, 10)}`,
    `Products: ${products.join('; ')}`
  ].join('\n');
}

export async function syncOrderEmbeddingServer(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      createdAt: true,
      items: { select: { title: true, quantity: true } }
    }
  });

  if (!order) {
    await prisma.embeddingDocument.deleteMany({
      where: { entityType: 'ORDER', entityId: orderId }
    });
    return;
  }

  const content = buildOrderEmbeddingText(order);
  const contentHash = createHash('sha256').update(content).digest('hex');
  const current = await prisma.embeddingDocument.findUnique({
    where: { entityType_entityId: { entityType: 'ORDER', entityId: orderId } },
    select: { userId: true, contentHash: true, embeddingModel: true, status: true }
  });

  if (
    current?.userId === order.userId &&
    current.contentHash === contentHash &&
    current.embeddingModel === CHATBOT_EMBEDDING.modelName &&
    current.status === 'ACTIVE'
  ) return;

  const embedding = await embedDocument(content);
  const vectorLiteral = `[${embedding.map((value) => value.toFixed(8)).join(',')}]`;

  await prisma.$executeRaw`
    INSERT INTO "EmbeddingDocument"
      ("id", "entityType", "entityId", "userId", "content", "embedding", "contentHash", "embeddingModel", "status", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, 'ORDER', ${order.id}, ${order.userId}, ${content}, ${vectorLiteral}::vector, ${contentHash}, ${CHATBOT_EMBEDDING.modelName}, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("entityType", "entityId") DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "content" = EXCLUDED."content",
      "embedding" = EXCLUDED."embedding",
      "contentHash" = EXCLUDED."contentHash",
      "embeddingModel" = EXCLUDED."embeddingModel",
      "status" = 'ACTIVE',
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function refreshOrderEmbeddingSafely(orderId: string): Promise<void> {
  try {
    await syncOrderEmbeddingServer(orderId);
  } catch (error) {
    // Order writes are committed before this best-effort indexing step.
    console.error(`[ShopFast Assistant] Failed to update order embedding ${orderId}`, error);
  }
}
