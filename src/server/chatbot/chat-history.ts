import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { CHATBOT_CONTEXT_MESSAGES } from '@/constants/chatbot';
import { getProductsByIdsServer } from '@/server/services/product.service';

export async function listChatSessionsServer(userId: string) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } }
    }
  });
}

export function createChatSessionServer(userId: string) {
  return prisma.chatSession.create({
    data: { userId, title: 'New Chat' },
    select: { id: true, title: true, createdAt: true, updatedAt: true }
  });
}

export async function getChatSessionServer(userId: string, sessionId: string, beforeId?: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, title: true, createdAt: true, updatedAt: true }
  });
  if (!session) return null;

  const pageSize = 50;
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
    ...(beforeId ? { cursor: { id: beforeId }, skip: 1 } : {}),
    select: { id: true, role: true, content: true, metadata: true, createdAt: true }
  });
  const hasMore = messages.length > pageSize;
  const page = messages.slice(0, pageSize).reverse();
  const cardIds = page.flatMap((message) => {
    if (message.role !== 'ASSISTANT' || !message.metadata || typeof message.metadata !== 'object' || Array.isArray(message.metadata)) return [];
    const cards = (message.metadata as Record<string, unknown>).productCards;
    return Array.isArray(cards)
      ? cards.flatMap((card) => card && typeof card === 'object' && 'id' in card && typeof card.id === 'string' ? [card.id] : [])
      : [];
  });
  const currentProducts = await getProductsByIdsServer(cardIds);
  const productsById = new Map(currentProducts.map((product) => [product.id, product]));
  const currentMessages = await Promise.all(page.map(async (message) => {
    if (message.role !== 'ASSISTANT' || !message.metadata || typeof message.metadata !== 'object' || Array.isArray(message.metadata)) {
      return message;
    }
    const metadata = message.metadata as Record<string, unknown>;
    if (!Array.isArray(metadata.productCards)) return message;

    const cards = metadata.productCards.map((value) => {
      if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') return null;
      const product = productsById.get(value.id);
      if (!product) return null;
      const reason = 'reason' in value && typeof value.reason === 'string' ? value.reason : 'Matches your request';
      return {
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.totalStock ?? product.stock ?? 0,
        category: product.category.name,
        reason,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          attributes: variant.attributes || {}
        }))
      };
    });

    return {
      ...message,
      metadata: { ...metadata, productCards: cards.filter((card) => card !== null) }
    };
  }));
  return {
    session,
    messages: currentMessages,
    hasMore,
    nextBeforeId: hasMore ? page[0]?.id : undefined
  };
}

export async function getRecentChatContextServer(userId: string, sessionId: string, excludeMessageId: string) {
  const messages = await prisma.chatMessage.findMany({
    where: {
      sessionId,
      id: { not: excludeMessageId },
      session: { userId }
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: CHATBOT_CONTEXT_MESSAGES,
    select: { role: true, content: true }
  });
  return messages
    .reverse()
    .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
    .map((message) => ({ role: message.role as 'USER' | 'ASSISTANT', content: message.content }));
}

export async function appendUserChatMessageServer(userId: string, sessionId: string, content: string) {
  const owned = await prisma.chatSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
  if (!owned) return null;
  const message = await prisma.chatMessage.create({
    data: { sessionId, role: 'USER', content },
    select: { id: true, role: true, content: true, createdAt: true }
  });
  await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
  return message;
}

export async function appendAssistantChatMessageServer(
  userId: string,
  sessionId: string,
  content: string,
  title?: string,
  metadata?: Prisma.InputJsonValue
) {
  const owned = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, title: true }
  });
  if (!owned) return null;

  const message = await prisma.chatMessage.create({
    data: { sessionId, role: 'ASSISTANT', content, metadata },
    select: { id: true, role: true, content: true, metadata: true, createdAt: true }
  });
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      updatedAt: new Date(),
      ...(owned.title === 'New Chat' && title ? { title } : {})
    }
  });
  return message;
}
