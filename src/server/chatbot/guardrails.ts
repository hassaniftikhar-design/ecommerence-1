export const CHATBOT_MAX_MESSAGE_LENGTH = 1000;

const injectionPatterns = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?)/i,
  /\b(?:reveal|show|print|repeat)\s+(?:the\s+)?(?:system|developer)\s+prompt\b/i,
  /(?:system|developer)\s+prompt.{0,30}(?:secret|key|token|credential)/i,
  /\b(?:select\s+.+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i,
  /\b(?:prisma|database)\s*(?:\.\$queryRaw|\.\$executeRaw|credentials|password)/i,
  /<\|(?:im_start|im_sep|im_end|ghissue)\|>/i
];

export type GuardrailResult =
  | { allowed: true; message: string }
  | { allowed: false; code: 'EMPTY' | 'TOO_LONG' | 'SECURITY_INJECTION'; reply: string };

export function applyChatGuardrails(value: unknown): GuardrailResult {
  if (typeof value !== 'string') {
    return { allowed: false, code: 'EMPTY', reply: 'Please enter a message so I can help with the store.' };
  }

  const message = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!message) {
    return { allowed: false, code: 'EMPTY', reply: 'Please enter a message so I can help with the store.' };
  }
  if (message.length > CHATBOT_MAX_MESSAGE_LENGTH) {
    return { allowed: false, code: 'TOO_LONG', reply: 'Please keep your message under 1,000 characters.' };
  }
  if (injectionPatterns.some((pattern) => pattern.test(message))) {
    return {
      allowed: false,
      code: 'SECURITY_INJECTION',
      reply: 'I can help with ShopFast products, orders, and your cart. What would you like to know?'
    };
  }

  return { allowed: true, message };
}
