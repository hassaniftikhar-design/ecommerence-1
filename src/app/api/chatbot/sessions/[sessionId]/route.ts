import { apiError, apiSuccess } from '@/lib/api-response';
import { getChatActor } from '@/server/chatbot/auth';
import { getChatSessionServer } from '@/server/chatbot/chat-history';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const actor = await getChatActor(request);
  if (!actor) return apiError('Unauthorized', [], 401);

  const { sessionId } = await params;
  const beforeId = new URL(request.url).searchParams.get('before') || undefined;

  try {
    const result = await getChatSessionServer(actor.userId, sessionId, beforeId);
    if (!result) return apiError('Chat session not found', [], 404);
    return apiSuccess('Chat session retrieved', result);
  } catch {
    return apiError('Unable to retrieve this chat session', [], 500);
  }
}
