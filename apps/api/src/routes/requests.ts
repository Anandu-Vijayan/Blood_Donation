import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { prisma } from '../db/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { scheduleNotificationTiers, cancelNotificationTiers } from '../workers/notification.worker.js';
import { recordDonationForRequest } from '../services/recordDonation.js';
import { BLOOD_GROUPS, COOLDOWN_DAYS, MATCH_CANCEL_WINDOW_MINUTES } from '../lib/constants.js';

const bloodGroupEnum = z.enum(BLOOD_GROUPS as [string, ...string[]]);

export async function requestRoutes(app: FastifyInstance) {
  // 5.1 POST /requests
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    if (!request.phoneNumber) {
      return reply.badRequest('Phone number is missing from auth token');
    }
    const body = z.object({
      full_name: z.string().min(1),
      blood_group: bloodGroupEnum,
      units: z.number().int().positive(),
      hospital_name: z.string().min(1),
      latitude: z.number(),
      longitude: z.number(),
      urgency: z.enum(['critical', 'urgent', 'normal']),
      requirement_type: z.enum(['specific', 'standby', 'replacement']).default('standby'),
      requirement_date: z.string().optional().nullable(),
    }).parse(request.body);

    const { encrypted, iv } = encrypt(request.phoneNumber);

    // Ensure user row exists (FK target for blood_requests)
    await prisma.users.upsert({
      where: { firebase_uid: firebaseUid },
      create: { firebase_uid: firebaseUid, is_recipient: true, full_name: body.full_name, phone_encrypted: encrypted, phone_iv: iv },
      update: { is_recipient: true, full_name: body.full_name, phone_encrypted: encrypted, phone_iv: iv },
    });

    // hospital_location is an Unsupported("geometry") column -- this insert
    // stays raw SQL via $queryRaw, same as donors.ts's geometry writes.
    const [req] = await prisma.$queryRaw<
      {
        id: number;
        blood_group: string;
        units: number;
        hospital_name: string;
        urgency: string;
        requirement_type: string;
        requirement_date: Date | null;
        status: string;
        created_at: Date;
      }[]
    >`
      INSERT INTO blood_requests (recipient_firebase_uid, blood_group, units, hospital_name, hospital_location, urgency, requirement_type, requirement_date)
      VALUES (
        ${firebaseUid},
        ${body.blood_group},
        ${body.units},
        ${body.hospital_name},
        ST_SetSRID(ST_MakePoint(${body.longitude}, ${body.latitude}), 4326),
        ${body.urgency},
        ${body.requirement_type},
        ${body.requirement_date ? new Date(body.requirement_date) : null}
      )
      RETURNING id, blood_group, units, hospital_name, urgency, requirement_type, requirement_date, status, created_at
    `;

    const [donorCountRow] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM donors d
      WHERE d.availability = TRUE
        AND d.blood_group = ${body.blood_group}
        AND (d.location IS NULL OR ST_DWithin(d.location::geography, ST_SetSRID(ST_MakePoint(${body.longitude}, ${body.latitude}), 4326)::geography, 50000))
    `;
    const nearbyDonorsCount = donorCountRow?.count || 0;

    await scheduleNotificationTiers(req.id);
    return reply.code(201).send({
      ...req,
      nearby_donors_count: nearbyDonorsCount,
      nearbyDonorsCount,
    });
  });

  // 5.2 GET /requests/open — urgency-sorted feed for donor's blood group, filtered by proximity to hospital.
  // Visibility radius matches the request's current notification tier (last_tier_radius_km), expanding over time.
  // Freshly-created requests (radius=0) are visible within 5km — the first tier — to avoid a gap before the worker fires.
  app.get('/open', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    // donors.location is an Unsupported("geometry") column -- stays raw SQL via $queryRaw.
    const [donor] = await prisma.$queryRaw<
      { blood_group: string; has_location: boolean }[]
    >`
      SELECT blood_group, (location IS NOT NULL) AS has_location FROM donors WHERE firebase_uid = ${firebaseUid}
    `;
    if (!donor) return reply.badRequest('Register as a donor first');
    if (!donor.has_location) return reply.badRequest('Donor location missing — please re-register');

    const rows = await prisma.$queryRaw<
      {
        id: number;
        blood_group: string;
        units: number;
        hospital_name: string;
        urgency: string;
        requirement_type: string;
        requirement_date: Date | null;
        created_at: Date;
        recipient_name: string | null;
        urgency_score: number;
        distance_km: string | null;
        nearby_donors_count: number;
      }[]
    >`
      SELECT
        r.id, r.blood_group, r.units, r.hospital_name, r.urgency, r.requirement_type, r.requirement_date, r.created_at,
        u.full_name AS recipient_name,
        CASE r.urgency
          WHEN 'critical' THEN 100
          WHEN 'urgent'   THEN 60
          ELSE                 20
        END AS urgency_score,
        ROUND(
          (ST_Distance(
            d.location::geography,
            r.hospital_location::geography
          ) / 1000)::numeric,
          1
        ) AS distance_km,
        (
          SELECT COUNT(*)::int
          FROM donors d2
          WHERE d2.availability = TRUE
            AND d2.blood_group = r.blood_group
            AND (r.hospital_location IS NULL OR d2.location IS NULL OR ST_DWithin(d2.location::geography, r.hospital_location::geography, 50000))
        ) AS nearby_donors_count
      FROM blood_requests r
      JOIN donors d ON d.firebase_uid = ${firebaseUid}
      LEFT JOIN users u ON u.firebase_uid = r.recipient_firebase_uid
      WHERE r.status = 'open'
        AND r.blood_group = d.blood_group
        AND r.recipient_firebase_uid != ${firebaseUid}
        AND (
          GREATEST(r.last_tier_radius_km, 5) >= 9999
          OR ST_DWithin(
               d.location::geography,
               r.hospital_location::geography,
               GREATEST(r.last_tier_radius_km, 5) * 1000
             )
        )
      ORDER BY urgency_score DESC, distance_km ASC, r.created_at ASC
    `;

    const formatted = rows.map((r) => ({
      ...r,
      recipient_name: r.recipient_name || 'Recipient',
      recipientName: r.recipient_name || 'Recipient',
      distance_km: r.distance_km != null ? Number(r.distance_km) : null,
      distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
      nearby_donors_count: Number(r.nearby_donors_count || 0),
      nearbyDonorsCount: Number(r.nearby_donors_count || 0),
    }));

    return reply.send(formatted);
  });

  // 5.3 GET /requests/:id
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    // hospital_location / donors.location / users.location are
    // Unsupported("geometry") columns -- stays raw SQL via $queryRaw.
    const [req] = await prisma.$queryRaw<
      {
        id: number;
        blood_group: string;
        units: number;
        hospital_name: string;
        urgency: string;
        requirement_type: string;
        requirement_date: Date | null;
        status: string;
        created_at: Date;
        recipient_name: string | null;
        distance_km: string | null;
        nearby_donors_count: number;
      }[]
    >`
      SELECT
        r.id, r.blood_group, r.units, r.hospital_name, r.urgency, r.requirement_type, r.requirement_date, r.status, r.created_at,
        u.full_name AS recipient_name,
        ROUND(
          (ST_Distance(
            COALESCE(d.location, caller_u.location)::geography,
            r.hospital_location::geography
          ) / 1000)::numeric,
          1
        ) AS distance_km,
        (
          SELECT COUNT(*)::int
          FROM donors d2
          WHERE d2.availability = TRUE
            AND d2.blood_group = r.blood_group
            AND (r.hospital_location IS NULL OR d2.location IS NULL OR ST_DWithin(d2.location::geography, r.hospital_location::geography, 50000))
        ) AS nearby_donors_count
      FROM blood_requests r
      LEFT JOIN users u ON u.firebase_uid = r.recipient_firebase_uid
      LEFT JOIN donors d ON d.firebase_uid = ${firebaseUid}
      LEFT JOIN users caller_u ON caller_u.firebase_uid = ${firebaseUid}
      WHERE r.id = ${id}
    `;
    if (!req) return reply.notFound('Request not found');

    return reply.send({
      ...req,
      recipient_name: req.recipient_name || 'Recipient',
      recipientName: req.recipient_name || 'Recipient',
      distance_km: req.distance_km != null ? Number(req.distance_km) : null,
      distanceKm: req.distance_km != null ? Number(req.distance_km) : null,
      nearby_donors_count: Number(req.nearby_donors_count || 0),
      nearbyDonorsCount: Number(req.nearby_donors_count || 0),
    });
  });

  // 5.4 PATCH /requests/:id/status — recipient marks fulfilled/unfulfilled/open
  app.patch('/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = z.object({ status: z.enum(['fulfilled', 'unfulfilled', 'open']) }).parse(request.body);

    const req = await prisma.blood_requests.findUnique({
      where: { id },
      select: { id: true, status: true, recipient_firebase_uid: true, last_tier_radius_km: true },
    });
    if (!req) return reply.notFound('Request not found');
    if (req.recipient_firebase_uid !== firebaseUid) return reply.forbidden('Not your request');

    if (body.status === 'fulfilled') {
      await prisma.$transaction(async (tx) => {
        await recordDonationForRequest(id, tx);
        await tx.blood_requests.update({ where: { id }, data: { status: 'fulfilled' } });
      });
    } else if (body.status === 'open') {
      await prisma.handshakes.updateMany({
        where: { request_id: id, cancelled_at: null },
        data: { cancelled_at: new Date() },
      });
      await prisma.blood_requests.update({ where: { id }, data: { status: 'open' } });
      await scheduleNotificationTiers(id);
    } else {
      await prisma.blood_requests.update({ where: { id }, data: { status: body.status } });

      // If unfulfilled and was matched, reopen and resume notification pipeline
      if (body.status === 'unfulfilled' && req.status === 'matched') {
        await prisma.handshakes.updateMany({
          where: { request_id: id, cancelled_at: null },
          data: { cancelled_at: new Date() },
        });
        await prisma.blood_requests.update({ where: { id }, data: { status: 'open' } });
        await scheduleNotificationTiers(id);
      }
    }

    return reply.send({ ok: true });
  });

  // 7.1 POST /requests/:id/accept
  app.post('/:id/accept', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    // Re-validate donor eligibility at acceptance time
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const donor = await prisma.donors.findFirst({
      where: {
        firebase_uid: firebaseUid,
        availability: true,
        OR: [{ last_donated_at: null }, { last_donated_at: { lt: cooldownCutoff } }],
      },
      select: { id: true, blood_group: true },
    });
    if (!donor) return reply.forbidden('You are not eligible to donate right now');

    // hospital_location is an Unsupported("geometry") column -- ST_X/ST_Y
    // extraction stays raw SQL via $queryRaw.
    const [req] = await prisma.$queryRaw<
      {
        id: number;
        status: string;
        blood_group: string;
        units: number;
        hospital_name: string;
        recipient_firebase_uid: string;
        lng: number;
        lat: number;
      }[]
    >`
      SELECT id, status, blood_group, units, hospital_name, recipient_firebase_uid,
             ST_X(hospital_location::geometry) AS lng,
             ST_Y(hospital_location::geometry) AS lat
      FROM blood_requests WHERE id = ${id}
    `;
    if (!req) return reply.notFound('Request not found');
    if (req.status !== 'open') return reply.conflict('This request has already been matched');
    if (req.blood_group !== donor.blood_group) return reply.badRequest('Blood group mismatch');

    const recipientUser = await prisma.users.findUnique({
      where: { firebase_uid: req.recipient_firebase_uid },
      select: {
        full_name: true,
        phone_encrypted: true,
        phone_iv: true,
        donors: { select: { full_name: true, phone_encrypted: true, phone_iv: true } },
      },
    });
    const recipientName = recipientUser?.full_name ?? recipientUser?.donors?.full_name ?? null;
    const recipientPhoneEncrypted = recipientUser?.phone_encrypted ?? recipientUser?.donors?.phone_encrypted ?? null;
    const recipientPhoneIv = recipientUser?.phone_iv ?? recipientUser?.donors?.phone_iv ?? null;
    if (!recipientPhoneEncrypted || !recipientPhoneIv) {
      return reply.unprocessableEntity('Recipient contact unavailable');
    }

    // Transactional: a request must never end up 'matched' without a
    // corresponding handshake row, or vice versa. Upsert instead of create --
    // a prior cancel-match leaves its (cancelled) handshake row in place
    // (see cancel-match below), and handshakes.request_id is @unique, so a
    // second accept on the same request must revive that row, not insert a
    // new one.
    await prisma.$transaction(async (tx) => {
      await tx.blood_requests.update({ where: { id }, data: { status: 'matched' } });
      await tx.handshakes.upsert({
        where: { request_id: id },
        create: { request_id: id, donor_id: donor.id },
        update: { donor_id: donor.id, matched_at: new Date(), cancelled_at: null },
      });
    });
    await cancelNotificationTiers(id);

    const recipientPhone = decrypt(recipientPhoneEncrypted, recipientPhoneIv);

    return reply.send({
      matched: true,
      recipient: {
        name: recipientName,
        phone: recipientPhone,
      },
      request: {
        hospital_name: req.hospital_name,
        latitude: req.lat,
        longitude: req.lng,
      },
    });
  });

  // 7.2 POST /requests/:id/cancel-match
  app.post('/:id/cancel-match', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const donor = await prisma.donors.findUnique({ where: { firebase_uid: firebaseUid }, select: { id: true } });
    if (!donor) return reply.forbidden('Donor profile not found');

    const handshake = await prisma.handshakes.findFirst({
      where: { request_id: id, donor_id: donor.id, cancelled_at: null },
      select: { id: true, matched_at: true },
    });
    if (!handshake) return reply.notFound('No active match found');

    // 7.3 Enforce 30-minute window
    const elapsedMinutes = (Date.now() - handshake.matched_at.getTime()) / 60000;
    if (elapsedMinutes > MATCH_CANCEL_WINDOW_MINUTES) {
      return reply.forbidden(`Cancellation window of ${MATCH_CANCEL_WINDOW_MINUTES} minutes has passed`);
    }

    await prisma.handshakes.update({ where: { id: handshake.id }, data: { cancelled_at: new Date() } });
    await prisma.blood_requests.update({ where: { id }, data: { status: 'open' } });
    await scheduleNotificationTiers(id);

    return reply.send({ ok: true, message: 'Match cancelled. Resuming notifications.' });
  });

  // 8.1 POST /requests/:id/complete
  app.post('/:id/complete', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const donor = await prisma.donors.findUnique({ where: { firebase_uid: firebaseUid }, select: { id: true, blood_group: true } });
    if (!donor) return reply.forbidden('Donor profile not found');

    const handshake = await prisma.handshakes.findFirst({
      where: { request_id: id, donor_id: donor.id, cancelled_at: null },
      select: { id: true },
    });
    if (!handshake) return reply.forbidden('No active match for this request');

    await prisma.$transaction(async (tx) => {
      await recordDonationForRequest(id, tx);
      await tx.blood_requests.update({ where: { id }, data: { status: 'fulfilled' } });
    });

    return reply.send({ ok: true, message: 'Donation recorded. You are in cooldown for 90 days.' });
  });
}
