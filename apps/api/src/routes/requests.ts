import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { sql } from '../db/client.js';
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
    await sql`
      INSERT INTO users (firebase_uid, is_recipient, full_name, phone_encrypted, phone_iv)
      VALUES (${firebaseUid}, TRUE, ${body.full_name}, ${encrypted}, ${iv})
      ON CONFLICT (firebase_uid) DO UPDATE
        SET is_recipient = TRUE,
            full_name = EXCLUDED.full_name,
            phone_encrypted = EXCLUDED.phone_encrypted,
            phone_iv = EXCLUDED.phone_iv
    `;

    const [req] = await sql`
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

    await scheduleNotificationTiers(req.id);
    return reply.code(201).send(req);
  });

  // 5.2 GET /requests/open — urgency-sorted feed for donor's blood group, filtered by proximity to hospital.
  // Visibility radius matches the request's current notification tier (last_tier_radius_km), expanding over time.
  // Freshly-created requests (radius=0) are visible within 5km — the first tier — to avoid a gap before the worker fires.
  app.get('/open', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const [donor] = await sql`
      SELECT blood_group, location FROM donors WHERE firebase_uid = ${firebaseUid}
    `;
    if (!donor) return reply.badRequest('Register as a donor first');
    if (!donor.location) return reply.badRequest('Donor location missing — please re-register');

    const rows = await sql`
      SELECT
        r.id, r.blood_group, r.units, r.hospital_name, r.urgency, r.requirement_type, r.requirement_date, r.created_at,
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
        ) AS distance_km
      FROM blood_requests r
      JOIN donors d ON d.firebase_uid = ${firebaseUid}
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
    return reply.send(rows);
  });

  // 5.3 GET /requests/:id
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const [req] = await sql`
      SELECT
        id, blood_group, units, hospital_name, urgency, requirement_type, requirement_date, status, created_at
      FROM blood_requests WHERE id = ${id}
    `;
    if (!req) return reply.notFound('Request not found');
    return reply.send(req);
  });

  // 5.4 PATCH /requests/:id/status — recipient marks fulfilled/unfulfilled
  app.patch('/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = z.object({ status: z.enum(['fulfilled', 'unfulfilled']) }).parse(request.body);

    const [req] = await sql`
      SELECT id, status, recipient_firebase_uid, last_tier_radius_km FROM blood_requests WHERE id = ${id}
    `;
    if (!req) return reply.notFound('Request not found');
    if (req.recipient_firebase_uid !== firebaseUid) return reply.forbidden('Not your request');

    if (body.status === 'fulfilled') {
      await sql.begin(async (tx) => {
        await recordDonationForRequest(id, tx);
        await tx`UPDATE blood_requests SET status = 'fulfilled' WHERE id = ${id}`;
      });
    } else {
      await sql`UPDATE blood_requests SET status = ${body.status} WHERE id = ${id}`;

      // If unfulfilled and was matched, reopen and resume notification pipeline
      if (body.status === 'unfulfilled' && req.status === 'matched') {
        await sql`UPDATE blood_requests SET status = 'open' WHERE id = ${id}`;
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
    const [donor] = await sql`
      SELECT id, blood_group
      FROM donors
      WHERE firebase_uid = ${firebaseUid}
        AND availability = TRUE
        AND (last_donated_at IS NULL OR last_donated_at < NOW() - INTERVAL '${sql(String(COOLDOWN_DAYS))} days')
    `;
    if (!donor) return reply.forbidden('You are not eligible to donate right now');

    const [req] = await sql`
      SELECT id, status, blood_group, units, hospital_name, recipient_firebase_uid,
             ST_X(hospital_location::geometry) AS lng,
             ST_Y(hospital_location::geometry) AS lat
      FROM blood_requests WHERE id = ${id}
    `;
    if (!req) return reply.notFound('Request not found');
    if (req.status !== 'open') return reply.conflict('This request has already been matched');
    if (req.blood_group !== donor.blood_group) return reply.badRequest('Blood group mismatch');

    const [recipient] = await sql`
      SELECT
        COALESCE(u.full_name, d.full_name) AS name,
        COALESCE(u.phone_encrypted, d.phone_encrypted) AS phone_encrypted,
        COALESCE(u.phone_iv, d.phone_iv) AS phone_iv
      FROM users u
      LEFT JOIN donors d ON d.firebase_uid = u.firebase_uid
      WHERE u.firebase_uid = ${req.recipient_firebase_uid}
    `;
    if (!recipient?.phone_encrypted || !recipient?.phone_iv) {
      return reply.unprocessableEntity('Recipient contact unavailable');
    }

    await sql`UPDATE blood_requests SET status = 'matched' WHERE id = ${id}`;
    await sql`
      INSERT INTO handshakes (request_id, donor_id) VALUES (${id}, ${donor.id})
    `;
    await cancelNotificationTiers(id);

    const recipientPhone = decrypt(recipient.phone_encrypted as string, recipient.phone_iv as string);

    return reply.send({
      matched: true,
      recipient: {
        name: recipient.name,
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

    const [donor] = await sql`SELECT id FROM donors WHERE firebase_uid = ${firebaseUid}`;
    if (!donor) return reply.forbidden('Donor profile not found');

    const [handshake] = await sql`
      SELECT id, matched_at FROM handshakes WHERE request_id = ${id} AND donor_id = ${donor.id} AND cancelled_at IS NULL
    `;
    if (!handshake) return reply.notFound('No active match found');

    // 7.3 Enforce 30-minute window
    const matchedAt = new Date(handshake.matched_at);
    const elapsedMinutes = (Date.now() - matchedAt.getTime()) / 60000;
    if (elapsedMinutes > MATCH_CANCEL_WINDOW_MINUTES) {
      return reply.forbidden(`Cancellation window of ${MATCH_CANCEL_WINDOW_MINUTES} minutes has passed`);
    }

    await sql`UPDATE handshakes SET cancelled_at = NOW() WHERE id = ${handshake.id}`;
    await sql`UPDATE blood_requests SET status = 'open' WHERE id = ${id}`;
    await scheduleNotificationTiers(id);

    return reply.send({ ok: true, message: 'Match cancelled. Resuming notifications.' });
  });

  // 8.1 POST /requests/:id/complete
  app.post('/:id/complete', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const [donor] = await sql`SELECT id, blood_group FROM donors WHERE firebase_uid = ${firebaseUid}`;
    if (!donor) return reply.forbidden('Donor profile not found');

    const [handshake] = await sql`
      SELECT id FROM handshakes WHERE request_id = ${id} AND donor_id = ${donor.id} AND cancelled_at IS NULL
    `;
    if (!handshake) return reply.forbidden('No active match for this request');

    await sql.begin(async (tx) => {
      await recordDonationForRequest(id, tx);
      await tx`UPDATE blood_requests SET status = 'fulfilled' WHERE id = ${id}`;
    });

    return reply.send({ ok: true, message: 'Donation recorded. You are in cooldown for 90 days.' });
  });
}
