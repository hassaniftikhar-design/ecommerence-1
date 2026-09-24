import 'server-only';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/server-auth';

import type { ChatActor } from './tools';

export async function getChatActor(request: Request): Promise<ChatActor | null> {
  const sessionUser = await getCurrentUser(request);
  const userId = sessionUser?.id || sessionUser?.sub;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true }
  });
  if (!user?.isActive) return null;

  return { userId: user.id, role: user.role };
}
