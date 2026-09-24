import { apiError, apiSuccess } from '@/lib/api-response';
import { getChatActor } from '@/server/chatbot/auth';
import { createChatSessionServer, listChatSessionsServer } from '@/server/chatbot/chat-history';
import { ChatRateLimitError, enforceChatRateLimit } from '@/server/chatbot/rate-limit';

export async function GET(request: Request) {
  const actor = await getChatActor(request);
  if (!actor) return apiError('Unauthorized', [], 401);

  try {
    const sessions = await listChatSessionsServer(actor.userId);
    return apiSuccess('Chat sessions retrieved', { sessions });
  } catch {
    return apiError('Unable to retrieve chat sessions', [], 500);
  }
}

export async function POST(request: Request) {
  const actor = await getChatActor(request);
  if (!actor) return apiError('Unauthorized', [], 401);

  try {
    await enforceChatRateLimit(actor.userId);
  } catch (error) {
    if (error instanceof ChatRateLimitError) return apiError(error.message, [], 429);
    return apiError('Unable to process this request', [], 503);
  }

  try {
    const session = await createChatSessionServer(actor.userId);
    return apiSuccess('Chat session created', { session }, 201);
  } catch {
    return apiError('Unable to create a chat session', [], 500);
  }
}
