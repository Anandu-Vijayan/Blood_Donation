import type { TransactionSql } from 'postgres';
import { sql } from '../db/client.js';

type DbClient = typeof sql | TransactionSql;

export async function recordDonationForRequest(
  requestId: number,
  tx: DbClient = sql,
): Promise<{ recorded: boolean }> {
  const [handshake] = await tx`
    SELECT h.donor_id, d.blood_group
    FROM handshakes h
    JOIN donors d ON d.id = h.donor_id
    WHERE h.request_id = ${requestId} AND h.cancelled_at IS NULL
  `;
  if (!handshake) return { recorded: false };

  const [existing] = await tx`
    SELECT id FROM donations WHERE request_id = ${requestId}
  `;
  if (existing) return { recorded: false };

  await tx`
    UPDATE donors
    SET last_donated_at = NOW(), donation_count = donation_count + 1
    WHERE id = ${handshake.donor_id}
  `;
  await tx`
    INSERT INTO donations (donor_id, request_id, blood_group)
    VALUES (${handshake.donor_id}, ${requestId}, ${handshake.blood_group})
  `;

  return { recorded: true };
}
