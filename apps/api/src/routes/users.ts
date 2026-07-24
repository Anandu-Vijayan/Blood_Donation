import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { sql } from '../db/client.js';
import { decrypt } from '../lib/crypto.js';
import { deleteUserAccount } from '../services/deleteUser.js';

const roleSchema = z.object({
  is_donor: z.boolean(),
  is_recipient: z.boolean(),
});

export async function userRoutes(app: FastifyInstance) {
  // Upsert user + set roles (called after Firebase auth on first login)
  app.post('/me', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const body = roleSchema.parse(request.body);

    const [user] = await sql`
      INSERT INTO users (firebase_uid, is_donor, is_recipient)
      VALUES (${firebaseUid}, ${body.is_donor}, ${body.is_recipient})
      ON CONFLICT (firebase_uid) DO UPDATE
        SET is_donor = EXCLUDED.is_donor, is_recipient = EXCLUDED.is_recipient
      RETURNING id, firebase_uid, is_donor, is_recipient
    `;
    return reply.send(user);
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const [user] = await sql`
      SELECT id, firebase_uid, is_donor, is_recipient, created_at
      FROM users WHERE firebase_uid = ${firebaseUid}
    `;
    if (!user) return reply.notFound('User not found');
    return reply.send(user);
  });

  app.delete('/me', { preHandler: requireAuth }, async (request, reply) => {
    const deleted = await deleteUserAccount(request.userId!);
    if (!deleted) return reply.notFound('User not found');
    return reply.code(204).send();
  });

  app.get('/me/requests', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;
    const rows = await sql`
      SELECT
        br.id,
        br.blood_group,
        br.units,
        br.hospital_name,
        br.urgency,
        br.status,
        br.created_at,
        (
          SELECT COUNT(*)::int
          FROM donors d2
          WHERE d2.availability = TRUE
            AND d2.blood_group = br.blood_group
            AND (br.hospital_location IS NULL OR d2.location IS NULL OR ST_DWithin(d2.location::geography, br.hospital_location::geography, 50000))
        ) AS nearby_donors_count,
        d.full_name        AS donor_name,
        d.phone_encrypted  AS donor_phone_encrypted,
        d.phone_iv         AS donor_phone_iv,
        h.matched_at       AS matched_at
      FROM blood_requests br
      LEFT JOIN handshakes h
        ON h.request_id = br.id AND h.cancelled_at IS NULL
      LEFT JOIN donors d
        ON d.id = h.donor_id
      WHERE br.recipient_firebase_uid = ${firebaseUid}
      ORDER BY br.created_at DESC
    `;

    const requests = rows.map((r) => {
      const matched_donor =
        r.donor_phone_encrypted && r.donor_phone_iv
          ? {
              name: r.donor_name as string,
              phone: decrypt(r.donor_phone_encrypted as string, r.donor_phone_iv as string),
              matched_at: r.matched_at as string,
            }
          : null;
      return {
        id: r.id,
        blood_group: r.blood_group,
        units: r.units,
        hospital_name: r.hospital_name,
        urgency: r.urgency,
        status: r.status,
        created_at: r.created_at,
        nearby_donors_count: Number(r.nearby_donors_count || 0),
        nearbyDonorsCount: Number(r.nearby_donors_count || 0),
        matched_donor,
      };
    });

    return reply.send({ requests });
  });

  // GET /users/me/stats
  app.get('/me/stats', { preHandler: requireAuth }, async (request, reply) => {
    const firebaseUid = request.userId!;

    // Find donor profile associated with this user
    const [donor] = await sql`
      SELECT id FROM donors WHERE firebase_uid = ${firebaseUid}
    `;

    if (!donor) {
      return reply.send({
        total_donations: 0,
        active_donations: 0,
        completed_donations: 0,
        totalDonations: 0,
        activeDonations: 0,
        completedDonations: 0,
      });
    }

    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM donations WHERE donor_id = ${donor.id}) AS completed_donations,
        (
          SELECT COUNT(*)::int
          FROM handshakes h
          JOIN blood_requests br ON br.id = h.request_id
          WHERE h.donor_id = ${donor.id}
            AND h.cancelled_at IS NULL
            AND br.status = 'matched'
        ) AS active_donations
    `;

    const completed = stats.completed_donations || 0;
    const active = stats.active_donations || 0;
    const total = completed + active;

    return reply.send({
      total_donations: total,
      active_donations: active,
      completed_donations: completed,
      totalDonations: total,
      activeDonations: active,
      completedDonations: completed,
    });
  });
}
