import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const searchSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(1).max(500).optional().default(40),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export async function hospitalRoutes(app: FastifyInstance) {
  // Search / list hospitals (public — no auth required)
  app.get('/', async (request, reply) => {
    const { search, limit } = searchSchema.parse(request.query);
    const trimmed = search?.trim();

    const hospitals = await prisma.hospitals.findMany({
      where: trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { city: { contains: trimmed, mode: 'insensitive' } },
              { district: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ is_custom: 'asc' }, { name: 'asc' }],
      take: limit,
      select: { id: true, name: true, city: true, district: true, latitude: true, longitude: true, is_custom: true },
    });

    return reply.send({ hospitals });
  });

  // Nearby hospitals (public — no auth required)
  app.get('/nearby', async (request, reply) => {
    const { lat, lng, radius_km, limit } = nearbySchema.parse(request.query);

    const rows = await prisma.$queryRaw`
      SELECT
        id, name, city, district, latitude, longitude, is_custom,
        ROUND((ST_DistanceSphere(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)) / 1000)::numeric, 1) AS distance_km
      FROM hospitals
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radius_km * 1000}
      )
      ORDER BY distance_km ASC
      LIMIT ${limit}
    `;
    return reply.send({ hospitals: rows });
  });

}
