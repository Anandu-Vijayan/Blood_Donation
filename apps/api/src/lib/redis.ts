import { Redis, type RedisOptions } from 'ioredis';

/**
 * BullMQ + ioredis need the Redis protocol URL (rediss://), NOT the Upstash REST URL.
 * Upstash Dashboard → your database → Connect → tab "ioredis" → copy the URL.
 */
export function resolveRedisUrl(): string {
  // Dashboards often keep surrounding quotes when a value is pasted from a .env line; ioredis rejects them.
  const direct = process.env.REDIS_URL?.trim().replace(/^["']+|["']+$/g, '').trim();
  if (direct) return direct;

  const host = process.env.UPSTASH_REDIS_HOST?.trim();
  const password = process.env.UPSTASH_REDIS_PASSWORD?.trim();
  if (host && password) {
    return `rediss://default:${encodeURIComponent(password)}@${host}:6379`;
  }

  if (process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      'UPSTASH_REDIS_REST_* is for @upstash/redis HTTP client only. ' +
        'This API uses BullMQ which needs REDIS_URL (rediss://...) from Upstash → Connect → ioredis.',
    );
  }

  return 'redis://localhost:6379';
}

function buildRedisOptions(url: string): RedisOptions {
  const isUpstash = url.includes('upstash.io');
  const isTls = url.startsWith('rediss://') || isUpstash;

  return {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false, // Upstash users may lack INFO permission (NOPERM)
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
    ...(isTls && !url.startsWith('rediss://') ? { tls: {} } : {}),
  };
}

const redisUrl = resolveRedisUrl();

export const redis = new Redis(redisUrl, buildRedisOptions(redisUrl));
