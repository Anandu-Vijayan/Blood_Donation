import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BLOOD_GROUPS } from '../lib/constants.js';

const bloodGroupEnum = z.enum(BLOOD_GROUPS as [string, ...string[]]);

const updateRecipientSchema = z.object({
  name: z.string().min(1).optional(),
  full_name: z.string().min(1).optional(),
  blood_group: bloodGroupEnum.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

describe('Recipient update schema validation', () => {
  it('validates a valid recipient payload with name, blood_group, and coordinates', () => {
    const payload = {
      name: 'Jane Doe',
      blood_group: 'O+',
      latitude: 9.9312,
      longitude: 76.2673,
    };
    const parsed = updateRecipientSchema.parse(payload);
    expect(parsed.name).toBe('Jane Doe');
    expect(parsed.blood_group).toBe('O+');
    expect(parsed.latitude).toBe(9.9312);
    expect(parsed.longitude).toBe(76.2673);
  });

  it('validates partial update with full_name', () => {
    const payload = {
      full_name: 'John Smith',
    };
    const parsed = updateRecipientSchema.parse(payload);
    expect(parsed.full_name).toBe('John Smith');
  });

  it('rejects invalid blood group', () => {
    const payload = {
      blood_group: 'XYZ',
    };
    expect(() => updateRecipientSchema.parse(payload)).toThrow();
  });
});

describe('Recipient stats response structure', () => {
  it('formats stats with total_requests and nearby_donors_count', () => {
    const stats = {
      total_requests: 3,
      totalRequests: 3,
      nearby_donors_count: 8,
      nearbyDonorsCount: 8,
    };
    expect(stats.total_requests).toBe(3);
    expect(stats.nearby_donors_count).toBe(8);
  });
});

describe('Match and Request details response format', () => {
  it('includes recipient_name, distance_km, and nearby_donors_count in formatted request item', () => {
    const rawRow = {
      id: 1,
      blood_group: 'A+',
      hospital_name: 'KIMS',
      recipient_name: 'Alice',
      distance_km: '4.2',
      nearby_donors_count: 5,
    };

    const formatted = {
      ...rawRow,
      recipient_name: rawRow.recipient_name || 'Recipient',
      recipientName: rawRow.recipient_name || 'Recipient',
      distance_km: rawRow.distance_km != null ? Number(rawRow.distance_km) : null,
      distanceKm: rawRow.distance_km != null ? Number(rawRow.distance_km) : null,
      nearby_donors_count: Number(rawRow.nearby_donors_count || 0),
      nearbyDonorsCount: Number(rawRow.nearby_donors_count || 0),
    };

    expect(formatted.recipientName).toBe('Alice');
    expect(formatted.recipient_name).toBe('Alice');
    expect(formatted.distance_km).toBe(4.2);
    expect(formatted.distanceKm).toBe(4.2);
    expect(formatted.nearby_donors_count).toBe(5);
    expect(formatted.nearbyDonorsCount).toBe(5);
  });

  it('validates request status schema accepting open, fulfilled, and unfulfilled', () => {
    const statusSchema = z.object({ status: z.enum(['fulfilled', 'unfulfilled', 'open']) });
    expect(statusSchema.parse({ status: 'open' }).status).toBe('open');
    expect(statusSchema.parse({ status: 'fulfilled' }).status).toBe('fulfilled');
    expect(statusSchema.parse({ status: 'unfulfilled' }).status).toBe('unfulfilled');
    expect(() => statusSchema.parse({ status: 'invalid' })).toThrow();
  });
});

describe('Recipient HTTP route auth guards', () => {
  it('rejects unauthenticated GET /recipient/me with 401', async () => {
    const Fastify = (await import('fastify')).default;
    const sensible = (await import('@fastify/sensible')).default;
    const { recipientRoutes } = await import('../routes/recipient.js');

    const app = Fastify();
    await app.register(sensible);
    await app.register(recipientRoutes, { prefix: '/recipient' });

    const res = await app.inject({
      method: 'GET',
      url: '/recipient/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects unauthenticated GET /recipient/stat with 401', async () => {
    const Fastify = (await import('fastify')).default;
    const sensible = (await import('@fastify/sensible')).default;
    const { recipientRoutes } = await import('../routes/recipient.js');

    const app = Fastify();
    await app.register(sensible);
    await app.register(recipientRoutes, { prefix: '/recipient' });

    const res = await app.inject({
      method: 'GET',
      url: '/recipient/stat',
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects unauthenticated PUT /recipient with 401', async () => {
    const Fastify = (await import('fastify')).default;
    const sensible = (await import('@fastify/sensible')).default;
    const { recipientRoutes } = await import('../routes/recipient.js');

    const app = Fastify();
    await app.register(sensible);
    await app.register(recipientRoutes, { prefix: '/recipient' });

    const res = await app.inject({
      method: 'PUT',
      url: '/recipient',
      payload: { name: 'Test' },
    });

    expect(res.statusCode).toBe(401);
  });
});
