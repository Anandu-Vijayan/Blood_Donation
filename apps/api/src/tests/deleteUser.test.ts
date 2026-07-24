import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { userRoutes } from '../routes/users.js';

describe('User deletion route and auth guard', () => {
  it('rejects unauthenticated DELETE /me with 401', async () => {
    const app = Fastify();
    await app.register(sensible);
    await app.register(userRoutes, { prefix: '/users' });

    const res = await app.inject({
      method: 'DELETE',
      url: '/users/me',
    });

    expect(res.statusCode).toBe(401);
  });
});
