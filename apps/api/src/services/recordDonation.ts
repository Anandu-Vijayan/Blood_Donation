import { prisma, Prisma } from '../db/prisma.js';

export async function recordDonationForRequest(
  requestId: number,
  tx: Prisma.TransactionClient = prisma,
): Promise<{ recorded: boolean }> {
  const handshake = await tx.handshakes.findFirst({
    where: { request_id: requestId, cancelled_at: null },
    select: { donor_id: true, donors: { select: { blood_group: true } } },
  });
  if (!handshake) return { recorded: false };

  const existing = await tx.donations.findFirst({
    where: { request_id: requestId },
    select: { id: true },
  });
  if (existing) return { recorded: false };

  await tx.donors.update({
    where: { id: handshake.donor_id },
    data: { last_donated_at: new Date(), donation_count: { increment: 1 } },
  });
  await tx.donations.create({
    data: {
      donor_id: handshake.donor_id,
      request_id: requestId,
      blood_group: handshake.donors.blood_group,
    },
  });

  return { recorded: true };
}
