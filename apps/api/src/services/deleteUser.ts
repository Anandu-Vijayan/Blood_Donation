import { prisma } from '../db/prisma.js';
import { auth } from '../lib/firebase.js';
import { cancelNotificationTiers } from '../workers/notification.worker.js';

export async function deleteUserAccount(firebaseUid: string): Promise<boolean> {
  const user = await prisma.users.findUnique({ where: { firebase_uid: firebaseUid }, select: { id: true } });
  if (!user) return false;

  const donor = await prisma.donors.findUnique({ where: { firebase_uid: firebaseUid }, select: { id: true } });
  const donorId = donor?.id;

  const recipientRequests = await prisma.blood_requests.findMany({
    where: { recipient_firebase_uid: firebaseUid },
    select: { id: true },
  });
  const recipientRequestIds = recipientRequests.map((r) => r.id);

  let matchedAsDonorRequestIds: number[] = [];
  if (donorId !== undefined) {
    const matchedHandshakes = await prisma.handshakes.findMany({
      where: { donor_id: donorId, cancelled_at: null },
      select: { request_id: true },
    });
    matchedAsDonorRequestIds = matchedHandshakes.map((h) => h.request_id);
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
    await prisma.blood_requests.updateMany({
      where: { id: { in: reopenIds } },
      data: { status: 'open' },
    });
  }

  await prisma.$transaction(async (tx) => {
    if (recipientRequestIds.length > 0 && donorId !== undefined) {
      await tx.notifications_log.deleteMany({
        where: { OR: [{ request_id: { in: recipientRequestIds } }, { donor_id: donorId }] },
      });
    } else if (recipientRequestIds.length > 0) {
      await tx.notifications_log.deleteMany({ where: { request_id: { in: recipientRequestIds } } });
    } else if (donorId !== undefined) {
      await tx.notifications_log.deleteMany({ where: { donor_id: donorId } });
    }

    if (recipientRequestIds.length > 0) {
      await tx.notifications_queue.deleteMany({ where: { request_id: { in: recipientRequestIds } } });
    }

    if (recipientRequestIds.length > 0 && donorId !== undefined) {
      await tx.handshakes.deleteMany({
        where: { OR: [{ request_id: { in: recipientRequestIds } }, { donor_id: donorId }] },
      });
    } else if (recipientRequestIds.length > 0) {
      await tx.handshakes.deleteMany({ where: { request_id: { in: recipientRequestIds } } });
    } else if (donorId !== undefined) {
      await tx.handshakes.deleteMany({ where: { donor_id: donorId } });
    }

    if (recipientRequestIds.length > 0 && donorId !== undefined) {
      await tx.donations.deleteMany({
        where: { OR: [{ donor_id: donorId }, { request_id: { in: recipientRequestIds } }] },
      });
    } else if (recipientRequestIds.length > 0) {
      await tx.donations.deleteMany({ where: { request_id: { in: recipientRequestIds } } });
    } else if (donorId !== undefined) {
      await tx.donations.deleteMany({ where: { donor_id: donorId } });
    }

    await tx.blood_requests.deleteMany({ where: { recipient_firebase_uid: firebaseUid } });
    await tx.donors.deleteMany({ where: { firebase_uid: firebaseUid } });
    await tx.users.deleteMany({ where: { firebase_uid: firebaseUid } });
  });

  try {
    await auth.deleteUser(firebaseUid);
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj?.code === 'auth/user-not-found') {
      // User is already deleted from Firebase Auth
    } else {
      console.error(
        `[deleteUserAccount] Warning: Failed to delete user ${firebaseUid} from Firebase Auth:`,
        errorObj?.message || err,
      );
    }
  }

  return true;
}
