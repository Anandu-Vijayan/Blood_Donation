import { sql } from '../db/client.js';
import { auth } from '../lib/firebase.js';
import { cancelNotificationTiers } from '../workers/notification.worker.js';

export async function deleteUserAccount(firebaseUid: string): Promise<boolean> {
  const [user] = await sql`SELECT id FROM users WHERE firebase_uid = ${firebaseUid}`;
  if (!user) return false;

  const [donor] = await sql`SELECT id FROM donors WHERE firebase_uid = ${firebaseUid}`;
  const donorId = donor ? (donor.id as number) : undefined;

  const recipientRows = await sql`
    SELECT id FROM blood_requests WHERE recipient_firebase_uid = ${firebaseUid}
  `;
  const recipientRequestIds = recipientRows.map((r) => r.id as number);

  let matchedAsDonorRequestIds: number[] = [];
  if (donorId !== undefined) {
    const matchedRows = await sql`
      SELECT request_id FROM handshakes
      WHERE donor_id = ${donorId} AND cancelled_at IS NULL
    `;
    matchedAsDonorRequestIds = matchedRows.map((r) => r.request_id as number);
  }

  const recipientSet = new Set(recipientRequestIds);
  const allRequestIds = [
    ...new Set([...recipientRequestIds, ...matchedAsDonorRequestIds]),
  ];

  for (const requestId of allRequestIds) {
    await cancelNotificationTiers(requestId);
  }

  const reopenIds = matchedAsDonorRequestIds.filter((id) => !recipientSet.has(id));
  if (reopenIds.length > 0) {
    await sql`
      UPDATE blood_requests SET status = 'open'
      WHERE id IN ${sql(reopenIds)}
    `;
  }

  await sql.begin(async (tx) => {
    if (recipientRequestIds.length > 0 && donorId !== undefined) {
      await tx`
        DELETE FROM notifications_log
        WHERE request_id IN ${tx(recipientRequestIds)} OR donor_id = ${donorId}
      `;
    } else if (recipientRequestIds.length > 0) {
      await tx`
        DELETE FROM notifications_log WHERE request_id IN ${tx(recipientRequestIds)}
      `;
    } else if (donorId !== undefined) {
      await tx`DELETE FROM notifications_log WHERE donor_id = ${donorId}`;
    }

    if (recipientRequestIds.length > 0) {
      await tx`
        DELETE FROM notifications_queue WHERE request_id IN ${tx(recipientRequestIds)}
      `;
    }

    if (recipientRequestIds.length > 0 && donorId !== undefined) {
      await tx`
        DELETE FROM handshakes
        WHERE request_id IN ${tx(recipientRequestIds)} OR donor_id = ${donorId}
      `;
    } else if (recipientRequestIds.length > 0) {
      await tx`DELETE FROM handshakes WHERE request_id IN ${tx(recipientRequestIds)}`;
    } else if (donorId !== undefined) {
      await tx`DELETE FROM handshakes WHERE donor_id = ${donorId}`;
    }

    if (recipientRequestIds.length > 0 && donorId !== undefined) {
      await tx`
        DELETE FROM donations
        WHERE donor_id = ${donorId} OR request_id IN ${tx(recipientRequestIds)}
      `;
    } else if (recipientRequestIds.length > 0) {
      await tx`DELETE FROM donations WHERE request_id IN ${tx(recipientRequestIds)}`;
    } else if (donorId !== undefined) {
      await tx`DELETE FROM donations WHERE donor_id = ${donorId}`;
    }

    await tx`DELETE FROM blood_requests WHERE recipient_firebase_uid = ${firebaseUid}`;
    await tx`DELETE FROM donors WHERE firebase_uid = ${firebaseUid}`;
    await tx`DELETE FROM users WHERE firebase_uid = ${firebaseUid}`;
  });

  await auth.deleteUser(firebaseUid);
  return true;
}
