import 'server-only';

import { createHash } from 'node:crypto';

import Redis from 'ioredis';

import { CHATBOT_RATE_LIMIT } from '@/constants/chatbot';

export class ChatRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many messages. Please wait a moment and try again.');
    this.name = 'ChatRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type LocalWindow = { count: number; resetAt: number };
const localWindows = new Map<string, LocalWindow>();
let redis: Redis | undefined;
let warnedRedisUnavailable = false;

function getRedisClient(): Redis | undefined {
  const url = process.env.REDIS_URL_BROKER;
  if (!url) return undefined;
  if (!redis) {
    redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      keyPrefix: 'shopfast:chatbot:',
      retryStrategy: (attempt) => Math.min(attempt * 100, 1000)
    });
    redis.on('error', () => undefined);
  }
  return redis;
}

function checkLocalWindow(userId: string, now: number): number | null {
  const current = localWindows.get(userId);
  if (!current || current.resetAt <= now) {
    localWindows.set(userId, { count: 1, resetAt: now + CHATBOT_RATE_LIMIT.windowSeconds * 1000 });
    if (localWindows.size > 10_000) {
      for (const [key, value] of localWindows) {
        if (value.resetAt <= now) localWindows.delete(key);
      }
    }
    return null;
  }
  current.count += 1;
  return current.count > CHATBOT_RATE_LIMIT.requests
    ? Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    : null;
}

export async function enforceChatRateLimit(userId: string): Promise<void> {
  const redisClient = getRedisClient();
  const now = Date.now();
  const userKey = createHash('sha256').update(userId).digest('hex');

  if (redisClient) {
    try {
      const count = Number(await redisClient.eval(
        'local count = redis.call(\'INCR\', KEYS[1]); if count == 1 then redis.call(\'EXPIRE\', KEYS[1], ARGV[1]); end; return count',
        1,
        `rate:${userKey}`,
        String(CHATBOT_RATE_LIMIT.windowSeconds)
      ));
      warnedRedisUnavailable = false;
      if (count > CHATBOT_RATE_LIMIT.requests) {
        throw new ChatRateLimitError(CHATBOT_RATE_LIMIT.windowSeconds);
      }
      return;
    } catch (error) {
      if (error instanceof ChatRateLimitError) throw error;
      if (!warnedRedisUnavailable) {
        console.warn('[ShopFast Assistant] Redis rate limiter unavailable; using process-local fallback');
        warnedRedisUnavailable = true;
      }
    }
  }

  const retryAfter = checkLocalWindow(userKey, now);
  if (retryAfter) throw new ChatRateLimitError(retryAfter);
}
