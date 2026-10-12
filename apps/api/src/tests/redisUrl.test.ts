import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveRedisUrl } from '../lib/redis.js';

describe('resolveRedisUrl', () => {
  const original = process.env.REDIS_URL;
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });

  it('returns a clean URL unchanged', () => {
    process.env.REDIS_URL = 'rediss://user:pw@host.upstash.io:6379';
    expect(resolveRedisUrl()).toBe('rediss://user:pw@host.upstash.io:6379');
  });

  it('strips stray surrounding double or single quotes and whitespace', () => {
    process.env.REDIS_URL = ' "rediss://user:pw@host.upstash.io:6379" ';
    expect(resolveRedisUrl()).toBe('rediss://user:pw@host.upstash.io:6379');
    process.env.REDIS_URL = "'rediss://user:pw@host.upstash.io:6379'";
    expect(resolveRedisUrl()).toBe('rediss://user:pw@host.upstash.io:6379');
  });

  it('strips a lone trailing quote', () => {
    process.env.REDIS_URL = 'rediss://user:pw@host.upstash.io:6379"';
    expect(resolveRedisUrl()).toBe('rediss://user:pw@host.upstash.io:6379');
  });
});
