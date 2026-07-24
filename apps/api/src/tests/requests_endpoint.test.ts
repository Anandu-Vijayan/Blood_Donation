import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { requestRoutes } from '../routes/requests.js';
import { registerErrorHandler } from '../plugins/errors.js';

describe('Requests status update & nearby donors API validation', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('accepts status "open" in PATCH /requests/:id/status (with mock auth)', async () => {
    const app = Fastify();
    await app.register(sensible);
    registerErrorHandler(app);
    await app.register(requestRoutes, { prefix: '/requests' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/requests/33/status',
      headers: {
        authorization: 'Bearer mock-user-123',
      },
      payload: { status: 'open' },
    });

    // Validated payload succeeds past Zod parse. (It may fail on DB connection in unit test environment, but not with 400 Bad Request validation error!)
    expect(res.statusCode).not.toBe(400);
  });

  it('accepts status "fulfilled" and "unfulfilled" in PATCH /requests/:id/status', async () => {
    const app = Fastify();
    await app.register(sensible);
    registerErrorHandler(app);
    await app.register(requestRoutes, { prefix: '/requests' });

    const resFulfilled = await app.inject({
      method: 'PATCH',
      url: '/requests/33/status',
      headers: { authorization: 'Bearer mock-user-123' },
      payload: { status: 'fulfilled' },
    });
    expect(resFulfilled.statusCode).not.toBe(400);

    const resUnfulfilled = await app.inject({
      method: 'PATCH',
      url: '/requests/33/status',
      headers: { authorization: 'Bearer mock-user-123' },
      payload: { status: 'unfulfilled' },
    });
    expect(resUnfulfilled.statusCode).not.toBe(400);
  });

  it('rejects invalid status values with 400 Bad Request when authenticated', async () => {
    const app = Fastify();
    await app.register(sensible);
    registerErrorHandler(app);
    await app.register(requestRoutes, { prefix: '/requests' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/requests/33/status',
      headers: { authorization: 'Bearer mock-user-123' },
      payload: { status: 'invalid_status' },
    });

    // Zod validation error is caught by registerErrorHandler and returned as 400 Bad Request
    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.message).toBe("Validation failed");
  });
});
