import 'server-only';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/server-auth';

import type { ChatActor } from './tools';

export async function getChatActor(request: Request): Promise<ChatActor> {
  try {
    const sessionUser = await getCurrentUser(request);
    const userId = sessionUser?.id || sessionUser?.sub;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true }
      });
      if (user?.isActive) {
        return { userId: user.id, role: user.role };
      }
    }
  } catch (error) {
    console.warn('[ShopFast Assistant] Failed to retrieve session user', error);
  }

  // Extract or generate a guest identifier
  const guestHeader = request.headers.get('x-guest-id');
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const guestId = guestHeader && guestHeader.length <= 100
    ? guestHeader
    : (forwardedFor ? `guest_ip_${forwardedFor}` : `guest_anon_${Date.now()}`);

  return { userId: guestId, role: 'GUEST' };
}

