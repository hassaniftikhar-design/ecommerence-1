import { apiError, apiSuccess } from '@/lib/api-response';
import { getChatActor } from '@/server/chatbot/auth';
import { appendAssistantChatMessageServer, appendUserChatMessageServer, createChatSessionServer, getChatSessionServer, getRecentChatContextServer } from '@/server/chatbot/chat-history';
import { applyChatGuardrails } from '@/server/chatbot/guardrails';
import { orchestrateChatMessage } from '@/server/chatbot/orchestrator';
import type { ChatbotResult } from '@/server/chatbot/orchestrator';
import { enforceChatRateLimit, ChatRateLimitError } from '@/server/chatbot/rate-limit';
import { generateChatTitle } from '@/server/chatbot/orchestrator';

export async function POST(request: Request) {
  const actor = await getChatActor(request);
  if (!actor) return apiError('Unauthorized', [], 401);

  try {
    await enforceChatRateLimit(actor.userId);
  } catch (error) {
    if (error instanceof ChatRateLimitError) {
      const response = apiError(error.message, [], 429);
      response.headers.set('Retry-After', String(error.retryAfterSeconds));
      return response;
    }
    return apiError('Unable to process this request', [], 503);
  }

  let body: { sessionId?: unknown; message?: unknown; context?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return apiError('Request body must be an object', [], 400);
    }
    body = parsed as { sessionId?: unknown; message?: unknown; context?: unknown };
  } catch {
    return apiError('Request body must be valid JSON', [], 400);
  }

  const guardrail = applyChatGuardrails(body.message);
  if (!guardrail.allowed && guardrail.code !== 'SECURITY_INJECTION') {
    return apiError(guardrail.reply, [], 400);
  }
  const userMessage = guardrail.allowed ? guardrail.message : String(body.message).trim();
  const requestedSessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;

  try {
    if (actor.role === 'GUEST') {
      const sessionId = requestedSessionId || `guest_${Date.now()}`;
      let result: ChatbotResult;
      if (!guardrail.allowed) {
        result = {
          message: guardrail.reply,
          products: [],
          actions: [],
          intent: 'SECURITY_INJECTION',
          productCards: []
        };
      } else {
        const rawContext = Array.isArray(body.context) ? body.context : [];
        const context = rawContext.map((c: unknown) => {
          const item = (c && typeof c === 'object') ? (c as Record<string, unknown>) : {};
          return {
            role: item.role === 'USER' ? ('USER' as const) : ('ASSISTANT' as const),
            content: typeof item.content === 'string' ? item.content : '',
            metadata: (item.metadata && typeof item.metadata === 'object') ? (item.metadata as Record<string, unknown>) : undefined
          };
        }).slice(-10);

        try {
          result = await orchestrateChatMessage({ actor, message: guardrail.message, context });
        } catch (error) {
          console.error('[ShopFast Assistant] Chat orchestration failed for guest', error);
          result = {
            message: 'I could not complete that request just now. Please try again in a moment.',
            products: [],
            actions: [],
            intent: 'OUT_OF_SCOPE',
            productCards: []
          };
        }
      }

      const now = new Date().toISOString();
      const userEntry = {
        id: `guest_u_${Date.now()}`,
        role: 'USER' as const,
        content: userMessage,
        createdAt: now
      };
      const assistantEntry = {
        id: `guest_a_${Date.now()}`,
        role: 'ASSISTANT' as const,
        content: result.message,
        createdAt: now,
        metadata: {
          productCards: result.productCards,
          actions: result.actions,
          intent: result.intent,
          state: result.state
        }
      };

      return apiSuccess('Chat response generated', {
        sessionId,
        userMessage: userEntry,
        message: assistantEntry,
        response: result
      });
    }

    // Authenticated user (USER or ADMIN)
    let sessionId: string;
    let isFirstMessage = !requestedSessionId;
    if (requestedSessionId) {
      const session = await getChatSessionServer(actor.userId, requestedSessionId);
      if (!session) return apiError('Chat session not found', [], 404);
      sessionId = session.session.id;
      isFirstMessage = session.messages.length === 0;
    } else {
      const session = await createChatSessionServer(actor.userId);
      sessionId = session.id;
    }

    const userEntry = await appendUserChatMessageServer(actor.userId, sessionId, userMessage);
    if (!userEntry) return apiError('Chat session not found', [], 404);

    let result: ChatbotResult;
    if (!guardrail.allowed) {
      result = {
        message: guardrail.reply,
        products: [],
        actions: [],
        intent: 'SECURITY_INJECTION',
        productCards: []
      };
    } else {
      const context = await getRecentChatContextServer(actor.userId, sessionId, userEntry.id);
      try {
        result = await orchestrateChatMessage({ actor, message: guardrail.message, context });
      } catch (error) {
        console.error('[ShopFast Assistant] Chat orchestration failed', error);
        result = {
          message: 'I could not complete that request just now. Please try again in a moment.',
          products: [],
          actions: [],
          intent: 'OUT_OF_SCOPE',
          productCards: []
        };
      }
    }

    const title = isFirstMessage && guardrail.allowed ? await generateChatTitle(userMessage) : undefined;
    const assistantEntry = await appendAssistantChatMessageServer(actor.userId, sessionId, result.message, title, {
      productCards: result.productCards,
      actions: result.actions,
      intent: result.intent,
      state: result.state
    });
    if (!assistantEntry) return apiError('Chat session not found', [], 404);

    return apiSuccess('Chat response generated', {
      sessionId,
      userMessage: userEntry,
      message: assistantEntry,
      response: result
    });
  } catch (error) {
    console.error('[ShopFast Assistant] Chat request failed', error);
    return apiError('Unable to process your message', [], 500);
  }
}

