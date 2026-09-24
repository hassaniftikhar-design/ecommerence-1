import 'server-only';

export type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function createGroqCompletion(messages: GroqMessage[], maxTokens = 450): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq is not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
      messages,
      max_completion_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`[ShopFast Assistant] Groq request failed with status ${response.status}: ${errorBody}`);
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Groq returned an empty response');
  return content;
}
