import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import { registerErrorHandler } from '../plugins/errors.js';

async function buildApp() {
  const app = Fastify();
  registerErrorHandler(app);
  app.get('/boom', async () => {
    throw new Error('relation "users" does not exist');
  });
  app.get('/bad', async () => {
    throw Object.assign(new Error('Bad input'), { statusCode: 400 });
  });
  return app;
}

describe('error handler', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('in production hides 5xx message and stack', async () => {
    process.env.NODE_ENV = 'production';
    const res = await (await buildApp()).inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ message: 'Internal Server Error' });
  });

  it('in production keeps 4xx message but no stack', async () => {
    process.env.NODE_ENV = 'production';
    const res = await (await buildApp()).inject({ method: 'GET', url: '/bad' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ message: 'Bad input' });
  });

  it('in development exposes message and stack', async () => {
    process.env.NODE_ENV = 'development';
    const res = await (await buildApp()).inject({ method: 'GET', url: '/boom' });
    expect(res.json().message).toBe('relation "users" does not exist');
    expect(res.json().stack).toBeDefined();
  });
});
