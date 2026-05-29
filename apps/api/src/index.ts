import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { donorRoutes } from './routes/donors.js';
import { requestRoutes } from './routes/requests.js';
import { userRoutes } from './routes/users.js';
import { hospitalRoutes } from './routes/hospitals.js';
import { startNotificationWorker, stopNotificationWorker } from './workers/notification.worker.js';
import { migrate } from './db/migrate.js';
import { sql } from './db/client.js';
import { redis } from './lib/redis.js';
import { loadConfig, getCorsOrigins } from './config.js';
import { registerErrorHandler } from './plugins/errors.js';
import './lib/firebase.js';

const config = loadConfig();
const app = Fastify({ logger: true });

registerErrorHandler(app);

await app.register(cors, {
  origin: getCorsOrigins(config),
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
});
await app.register(sensible);

await app.register(userRoutes, { prefix: '/users' });
await app.register(donorRoutes, { prefix: '/donors' });
await app.register(requestRoutes, { prefix: '/requests' });
await app.register(hospitalRoutes, { prefix: '/hospitals' });

app.get('/health', async (_request, reply) => {
  try {
    await sql`SELECT 1`;
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      return reply.code(503).send({ ok: false, error: 'Redis unhealthy' });
    }
    return { ok: true, postgres: true, redis: true };
  } catch (err) {
    app.log.error(err);
    return reply.code(503).send({ ok: false, error: 'Dependency check failed' });
  }
});

if (config.RUN_MIGRATIONS_ON_START) {
  await migrate();
}

startNotificationWorker();

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down`);
  await app.close();
  await stopNotificationWorker();
  await sql.end();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

const port = config.PORT;
await app.listen({ port, host: '0.0.0.0' });
