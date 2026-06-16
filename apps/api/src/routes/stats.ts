import { FastifyInstance } from 'fastify';
import { sql } from '../db/client.js';

export async function statsRoutes(app: FastifyInstance) {
  const handler = async () => {
    const [row] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM blood_requests) AS total_requests,
        (SELECT COUNT(*)::int FROM blood_requests WHERE status = 'open') AS total_open,
        (SELECT COUNT(*)::int FROM blood_requests WHERE status = 'matched') AS total_in_process,
        (SELECT COUNT(*)::int FROM blood_requests WHERE status = 'fulfilled') AS total_fulfilled,
        (SELECT COUNT(*)::int FROM donors) AS total_donors,
        (SELECT COUNT(*)::int FROM hospitals) AS total_hospitals
    `;
    return row;
  };

  // Public — no auth required
  app.get('/stats', handler);
  app.get('/dashboard/summary', handler);
}
