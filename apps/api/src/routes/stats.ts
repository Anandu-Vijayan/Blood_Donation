import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';

export async function statsRoutes(app: FastifyInstance) {
  const handler = async () => {
    const [total_requests, total_open, total_in_process, total_fulfilled, total_donors, total_hospitals] =
      await Promise.all([
        prisma.blood_requests.count(),
        prisma.blood_requests.count({ where: { status: 'open' } }),
        prisma.blood_requests.count({ where: { status: 'matched' } }),
        prisma.blood_requests.count({ where: { status: 'fulfilled' } }),
        prisma.donors.count(),
        prisma.hospitals.count(),
      ]);

    return { total_requests, total_open, total_in_process, total_fulfilled, total_donors, total_hospitals };
  };

  // Public — no auth required
  app.get('/stats', handler);
  app.get('/dashboard/summary', handler);
}
