import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { prisma, updateOrNull } from '../db/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { BLOOD_GROUPS, COOLDOWN_DAYS } from '../lib/constants.js';

const bloodGroupEnum = z.enum(BLOOD_GROUPS as [string, ...string[]]);

export async function donorRoutes(app: FastifyInstance) {
  // 4.1 POST /donors
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    if (!request.phoneNumber) {
      return reply.badRequest('Phone number is missing from auth token');
    }
    const body = z.object({
      blood_group: bloodGroupEnum,
      latitude: z.number(),
      longitude: z.number(),
      full_name: z.string().min(1),
      availability: z.boolean().default(true),
    }).parse(request.body);

    const { encrypted, iv } = encrypt(request.phoneNumber);

    // Ensure user row exists (FK target for donors)
    await prisma.users.upsert({
      where: { firebase_uid: firebaseUid },
      create: { firebase_uid: firebaseUid, is_donor: true },
      update: { is_donor: true },
    });

    const existing = await prisma.donors.findUnique({
      where: { firebase_uid: firebaseUid },
      select: { id: true, blood_group: true, availability: true, donation_count: true },
    });
    if (existing) {
      return reply.send(existing);
    }

    // location is an Unsupported("geometry") column -- Prisma Client cannot
    // write to it at all, so this insert stays raw SQL via $queryRaw.
    const [donor] = await prisma.$queryRaw<
      { id: number; blood_group: string; availability: boolean; donation_count: number }[]
    >`
      INSERT INTO donors (firebase_uid, blood_group, location, full_name, phone_encrypted, phone_iv, availability)
      VALUES (
        ${firebaseUid},
        ${body.blood_group},
        ST_SetSRID(ST_MakePoint(${body.longitude}, ${body.latitude}), 4326),
        ${body.full_name},
        ${encrypted},
        ${iv},
        ${body.availability}
      )
      RETURNING id, blood_group, availability, donation_count
    `;

    await prisma.users.update({ where: { firebase_uid: firebaseUid }, data: { is_donor: true } });

    return reply.code(201).send(donor);
  });

  // 4.2 PATCH /donors/me/location
  app.patch('/me/location', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const body = z.object({ latitude: z.number(), longitude: z.number() }).parse(request.body);

    const [donor] = await prisma.$queryRaw<{ id: number }[]>`
      UPDATE donors
      SET location = ST_SetSRID(ST_MakePoint(${body.longitude}, ${body.latitude}), 4326)
      WHERE firebase_uid = ${firebaseUid}
      RETURNING id
    `;
    if (!donor) return reply.notFound('Donor profile not found');
    return reply.send({ ok: true });
  });

  // 4.3 PATCH /donors/me/availability
  app.patch('/me/availability', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const body = z.object({ available: z.boolean() }).parse(request.body);

    const donor = await updateOrNull(() =>
      prisma.donors.update({
        where: { firebase_uid: firebaseUid },
        data: { availability: body.available },
        select: { id: true, availability: true },
      }),
    );
    if (!donor) return reply.notFound('Donor profile not found');
    return reply.send(donor);
  });

  // 4.x PATCH /donors/me/phone
  app.patch('/me/phone', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    if (!request.phoneNumber) {
      return reply.badRequest('Phone number is missing from auth token');
    }

    const { encrypted, iv } = encrypt(request.phoneNumber);

    const donor = await updateOrNull(() =>
      prisma.donors.update({
        where: { firebase_uid: firebaseUid },
        data: { phone_encrypted: encrypted, phone_iv: iv },
        select: { id: true },
      }),
    );
    if (!donor) return reply.notFound('Donor profile not found');
    return reply.send({ ok: true });
  });

  // 4.x PATCH /donors/me/blood-group
  app.patch('/me/blood-group', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const body = z.object({ blood_group: bloodGroupEnum }).parse(request.body);

    const donor = await updateOrNull(() =>
      prisma.donors.update({
        where: { firebase_uid: firebaseUid },
        data: { blood_group: body.blood_group },
        select: { id: true, blood_group: true },
      }),
    );
    if (!donor) return reply.notFound('Donor profile not found');
    return reply.send(donor);
  });

  // 4.x PATCH /donors/me/name
  app.patch('/me/name', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const body = z.object({ full_name: z.string().min(1) }).parse(request.body);

    const donor = await updateOrNull(() =>
      prisma.donors.update({
        where: { firebase_uid: firebaseUid },
        data: { full_name: body.full_name },
        select: { id: true, full_name: true },
      }),
    );
    if (!donor) return reply.notFound('Donor profile not found');
    return reply.send(donor);
  });

  // 4.4 GET /donors/me
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const [donor] = await prisma.$queryRaw<
      {
        id: number;
        blood_group: string;
        availability: boolean;
        donation_count: number;
        full_name: string;
        last_donated_at: Date | null;
        phone_encrypted: string;
        phone_iv: string;
        longitude: number | null;
        latitude: number | null;
        in_cooldown: boolean;
      }[]
    >`
      SELECT
        id, blood_group, availability, donation_count, full_name,
        last_donated_at,
        phone_encrypted, phone_iv,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude,
        (last_donated_at IS NOT NULL AND last_donated_at > NOW() - (${COOLDOWN_DAYS} * INTERVAL '1 day')) AS in_cooldown
      FROM donors WHERE firebase_uid = ${firebaseUid}
    `;
    if (!donor) return reply.notFound('Donor profile not found');

    const phone = decrypt(donor.phone_encrypted, donor.phone_iv);

    return reply.send({
      id: donor.id,
      blood_group: donor.blood_group,
      full_name: donor.full_name,
      availability: donor.availability,
      donation_count: donor.donation_count,
      last_donated_at: donor.last_donated_at,
      in_cooldown: donor.in_cooldown,
      phone: phone,
      latitude: donor.latitude,
      longitude: donor.longitude
    });
  });

  // GET /donors/me/matches
  app.get('/me/matches', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const donor = await prisma.donors.findUnique({
      where: { firebase_uid: firebaseUid },
      select: { id: true, full_name: true, phone_encrypted: true, phone_iv: true },
    });
    if (!donor) return reply.notFound('Donor profile not found');

    const matches = await prisma.$queryRaw<
      {
        request_id: number;
        blood_group: string;
        units: number;
        hospital_name: string;
        urgency: string;
        status: string;
        created_at: Date;
        matched_at: Date;
        recipient_name: string | null;
        distance_km: string | null;
      }[]
    >`
      SELECT
        br.id AS request_id,
        br.blood_group,
        br.units,
        br.hospital_name,
        br.urgency,
        br.status,
        br.created_at,
        h.matched_at,
        u.full_name AS recipient_name,
        ROUND(
          (ST_Distance(
            d.location::geography,
            br.hospital_location::geography
          ) / 1000)::numeric,
          1
        ) AS distance_km
      FROM handshakes h
      JOIN blood_requests br ON br.id = h.request_id
      JOIN donors d ON d.id = h.donor_id
      LEFT JOIN users u ON u.firebase_uid = br.recipient_firebase_uid
      WHERE h.donor_id = ${donor.id} AND h.cancelled_at IS NULL AND br.status = 'matched'
      ORDER BY h.matched_at DESC
    `;

    const donorPhone = decrypt(donor.phone_encrypted, donor.phone_iv);

    const formattedMatches = matches.map((m) => ({
      requestId: m.request_id,
      blood_group: m.blood_group,
      units: m.units,
      hospitalName: m.hospital_name,
      urgency: m.urgency,
      status: m.status,
      created_at: m.created_at,
      matched_at: m.matched_at,
      donorName: donor.full_name,
      donorPhone: donorPhone,
      recipientName: m.recipient_name || 'Recipient',
      recipient_name: m.recipient_name || 'Recipient',
      distance_km: m.distance_km != null ? Number(m.distance_km) : null,
      distanceKm: m.distance_km != null ? Number(m.distance_km) : null,
    }));

    return reply.send(formattedMatches);
  });

  // GET /donors/me/donations (Task 8.2)
  app.get('/me/donations', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const donor = await prisma.donors.findUnique({ where: { firebase_uid: firebaseUid }, select: { id: true } });
    if (!donor) return reply.notFound('Donor profile not found');

    const donations = await prisma.donations.findMany({
      where: { donor_id: donor.id },
      orderBy: { donated_at: 'desc' },
      select: { blood_group: true, donated_at: true, request_id: true },
    });
    return reply.send(donations);
  });

  // POST /donors/me/push-token (for notification registration)
  app.post('/me/push-token', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const body = z.object({ token: z.string() }).parse(request.body);
    // updateMany, not update: original behavior never 404s here even if no
    // donor row matches -- it always just returns { ok: true }.
    await prisma.donors.updateMany({ where: { firebase_uid: firebaseUid }, data: { push_token: body.token } });
    return reply.send({ ok: true });
  });
}
