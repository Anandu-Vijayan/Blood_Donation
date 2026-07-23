import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { sql } from '../db/client.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { BLOOD_GROUPS } from '../lib/constants.js';

const bloodGroupEnum = z.enum(BLOOD_GROUPS as [string, ...string[]]);

const updateRecipientSchema = z.object({
  name: z.string().min(1).optional(),
  full_name: z.string().min(1).optional(),
  blood_group: bloodGroupEnum.optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function recipientRoutes(app: FastifyInstance) {
  // GET /recipient/me — Get current recipient profile
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const [user] = await sql`
      SELECT
        id,
        firebase_uid,
        full_name,
        blood_group,
        phone_encrypted,
        phone_iv,
        is_recipient,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude
      FROM users
      WHERE firebase_uid = ${firebaseUid}
    `;

    if (!user) {
      return reply.notFound('Recipient profile not found');
    }

    const phone = user.phone_encrypted && user.phone_iv
      ? decrypt(user.phone_encrypted, user.phone_iv)
      : null;

    return reply.send({
      id: user.id,
      firebase_uid: user.firebase_uid,
      full_name: user.full_name || null,
      name: user.full_name || null,
      blood_group: user.blood_group || null,
      latitude: user.latitude !== null ? Number(user.latitude) : null,
      longitude: user.longitude !== null ? Number(user.longitude) : null,
      phone,
      is_recipient: user.is_recipient,
    });
  });

  // GET /recipient/stat — Return recipient stats (total requests & nearby donors count)
  app.get('/stat', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;

    // 1. Get total requests by this recipient
    const [reqCountRow] = await sql`
      SELECT COUNT(*)::int AS count
      FROM blood_requests
      WHERE recipient_firebase_uid = ${firebaseUid}
    `;
    const totalRequests = reqCountRow?.count || 0;

    // 2. Get recipient's location and blood group (from users or latest blood request)
    const [recipientInfo] = await sql`
      SELECT
        u.blood_group,
        ST_X(u.location::geometry) AS u_lng,
        ST_Y(u.location::geometry) AS u_lat,
        ST_X(r.hospital_location::geometry) AS r_lng,
        ST_Y(r.hospital_location::geometry) AS r_lat,
        r.blood_group AS req_blood_group
      FROM users u
      LEFT JOIN blood_requests r ON r.recipient_firebase_uid = u.firebase_uid
      WHERE u.firebase_uid = ${firebaseUid}
      ORDER BY r.created_at DESC
      LIMIT 1
    `;

    const bg = recipientInfo?.blood_group || recipientInfo?.req_blood_group || null;
    const hasUserLoc = recipientInfo?.u_lng != null && recipientInfo?.u_lat != null;
    const hasReqLoc = recipientInfo?.r_lng != null && recipientInfo?.r_lat != null;

    let nearbyDonorsCount = 0;

    if (hasUserLoc) {
      const [donorCountRow] = await sql`
        SELECT COUNT(*)::int AS count
        FROM donors d
        JOIN users u ON u.firebase_uid = ${firebaseUid}
        WHERE d.availability = TRUE
          AND ST_DWithin(d.location::geography, u.location::geography, 50000)
          AND (${bg}::text IS NULL OR d.blood_group = ${bg})
      `;
      nearbyDonorsCount = donorCountRow?.count || 0;
    } else if (hasReqLoc) {
      const [donorCountRow] = await sql`
        SELECT COUNT(*)::int AS count
        FROM donors d
        WHERE d.availability = TRUE
          AND ST_DWithin(
            d.location::geography,
            ST_SetSRID(ST_MakePoint(${recipientInfo.r_lng}, ${recipientInfo.r_lat}), 4326)::geography,
            50000
          )
          AND (${bg}::text IS NULL OR d.blood_group = ${bg})
      `;
      nearbyDonorsCount = donorCountRow?.count || 0;
    } else {
      // Fallback if no location recorded yet: count all available donors (filtered by blood group if set)
      const [donorCountRow] = await sql`
        SELECT COUNT(*)::int AS count
        FROM donors d
        WHERE d.availability = TRUE
          AND (${bg}::text IS NULL OR d.blood_group = ${bg})
      `;
      nearbyDonorsCount = donorCountRow?.count || 0;
    }

    return reply.send({
      total_requests: totalRequests,
      totalRequests,
      nearby_donors_count: nearbyDonorsCount,
      nearbyDonorsCount,
    });
  });

  // PUT /recipient & PUT /recipient/me — Update recipient profile (location, name, blood group)
  const putHandler = async (request: any, reply: any) => {
    const firebaseUid = request.userId!;
    const body = updateRecipientSchema.parse(request.body);

    const name = body.full_name || body.name || null;
    const hasLoc = body.latitude !== undefined && body.longitude !== undefined;

    let phoneEncrypted: string | null = null;
    let phoneIv: string | null = null;
    if (request.phoneNumber) {
      const { encrypted, iv } = encrypt(request.phoneNumber);
      phoneEncrypted = encrypted;
      phoneIv = iv;
    }

    const lat = body.latitude ?? 0;
    const lng = body.longitude ?? 0;
    const locationFragment = hasLoc ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)` : null;

    // Upsert into users table
    await sql`
      INSERT INTO users (
        firebase_uid,
        is_recipient,
        full_name,
        blood_group,
        location,
        phone_encrypted,
        phone_iv
      )
      VALUES (
        ${firebaseUid},
        TRUE,
        ${name},
        ${body.blood_group || null},
        ${locationFragment},
        ${phoneEncrypted},
        ${phoneIv}
      )
      ON CONFLICT (firebase_uid) DO UPDATE SET
        is_recipient = TRUE,
        full_name = COALESCE(${name}, users.full_name),
        blood_group = COALESCE(${body.blood_group || null}, users.blood_group),
        location = CASE
          WHEN ${hasLoc} THEN ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
          ELSE users.location
        END,
        phone_encrypted = COALESCE(${phoneEncrypted}, users.phone_encrypted),
        phone_iv = COALESCE(${phoneIv}, users.phone_iv)
    `;

    const [updatedUser] = await sql`
      SELECT
        id,
        firebase_uid,
        full_name,
        blood_group,
        phone_encrypted,
        phone_iv,
        is_recipient,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude
      FROM users
      WHERE firebase_uid = ${firebaseUid}
    `;

    const phone = updatedUser.phone_encrypted && updatedUser.phone_iv
      ? decrypt(updatedUser.phone_encrypted, updatedUser.phone_iv)
      : null;

    return reply.send({
      id: updatedUser.id,
      firebase_uid: updatedUser.firebase_uid,
      full_name: updatedUser.full_name || null,
      name: updatedUser.full_name || null,
      blood_group: updatedUser.blood_group || null,
      latitude: updatedUser.latitude !== null ? Number(updatedUser.latitude) : null,
      longitude: updatedUser.longitude !== null ? Number(updatedUser.longitude) : null,
      phone,
      is_recipient: updatedUser.is_recipient,
    });
  };

  app.put('/', { preHandler: requireAuth }, putHandler);
  app.put('/me', { preHandler: requireAuth }, putHandler);
}
