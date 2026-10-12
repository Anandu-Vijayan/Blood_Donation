import { Worker, Queue, Job } from 'bullmq';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { redis } from '../lib/redis.js';
import { prisma } from '../db/prisma.js';
import { NOTIFICATION_TIERS, COOLDOWN_DAYS } from '../lib/constants.js';

// BullMQ needs Redis EVAL/EVALSHA. Some Redis users (restricted Upstash ACLs) lack it, so we probe at
// startup and fall back to in-process timers. Fallback timers are lost on restart.
let notificationQueue: Queue<NotificationJobData> | null = null;
const memoryTimers = new Map<string, NodeJS.Timeout>();

const expo = new Expo();

let notificationWorker: Worker<NotificationJobData> | null = null;

interface NotificationJobData {
  requestId: number;
  tier: number;
  radiusKm: number;
}

// Queries eligible donors within radius, sends push notifications, logs to notifications_log
export async function dispatchNotificationTier(requestId: number, radiusKm: number, tier: number) {
  // hospital_location is an Unsupported("geometry") column -- ST_X/ST_Y extraction
  // stays raw SQL via $queryRaw, same as donors.ts's geometry writes.
  const [request] = await prisma.$queryRaw<
    { id: number; blood_group: string; hospital_name: string; lng: number; lat: number; urgency: string; status: string }[]
  >`
    SELECT id, blood_group, hospital_name,
           ST_X(hospital_location::geometry) AS lng,
           ST_Y(hospital_location::geometry) AS lat,
           urgency, status
    FROM blood_requests WHERE id = ${requestId}
  `;

  if (!request || request.status !== 'open') return;

  const regionWide = radiusKm >= 9999;

  // Eligible donors: exact blood group, active, not in cooldown, not already notified, has push token
  const donors = await prisma.$queryRaw<
    { id: number; push_token: string | null; full_name: string }[]
  >`
    SELECT d.id, d.push_token, d.full_name
    FROM donors d
    WHERE d.blood_group = ${request.blood_group}
      AND d.availability = TRUE
      AND d.push_token IS NOT NULL
      AND (d.last_donated_at IS NULL OR d.last_donated_at < NOW() - (${COOLDOWN_DAYS} * INTERVAL '1 day'))
      AND NOT EXISTS (
        SELECT 1 FROM notifications_log nl
        WHERE nl.donor_id = d.id AND nl.request_id = ${requestId}
      )
      AND (
        ${regionWide} OR
        ST_DWithin(
          d.location::geography,
          ST_SetSRID(ST_MakePoint(${request.lng}, ${request.lat}), 4326)::geography,
          ${radiusKm * 1000}
        )
      )
    ORDER BY ST_Distance(
      d.location::geography,
      ST_SetSRID(ST_MakePoint(${request.lng}, ${request.lat}), 4326)::geography
    )
  `;

  if (donors.length === 0) return;

  const messages: ExpoPushMessage[] = donors
    .filter((d) => Expo.isExpoPushToken(d.push_token ?? ''))
    .map((d) => ({
      to: d.push_token!,
      title: `Blood needed: ${request.blood_group}`,
      body: `${request.hospital_name} needs ${request.blood_group} blood. Can you help?`,
      data: { requestId, type: 'blood_request' },
      sound: 'default' as const,
    }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch {
      // Continue — individual delivery failure shouldn't block others
    }
  }

  // Log all notified donors to prevent duplicate dispatch in later tiers
  if (donors.length > 0) {
    await prisma.notifications_log.createMany({
      data: donors.map((d) => ({ request_id: requestId, donor_id: d.id, tier })),
      skipDuplicates: true,
    });
  }

  // Update last dispatched tier radius on the request
  await prisma.blood_requests.update({
    where: { id: requestId },
    data: { last_tier_radius_km: radiusKm },
  });
}

async function redisSupportsEval(): Promise<boolean> {
  try {
    await redis.eval('return 1', 0);
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes('NOPERM')) return false;
    throw err;
  }
}

export async function startNotificationWorker() {
  if (!(await redisSupportsEval())) {
    console.warn('[notifications] Redis user lacks EVAL permission; using in-memory tier scheduling (timers are lost on restart).');
    return null;
  }
  notificationQueue = new Queue<NotificationJobData>('notifications', { connection: redis, skipVersionCheck: true });
  notificationWorker = new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { requestId, tier, radiusKm } = job.data;
      await dispatchNotificationTier(requestId, radiusKm, tier);
    },
    { connection: redis, skipVersionCheck: true },
  );
  return notificationWorker;
}

export async function stopNotificationWorker() {
  for (const t of memoryTimers.values()) clearTimeout(t);
  memoryTimers.clear();
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
}

const tierJobId = (requestId: number, tier: number) => `request-${requestId}-tier-${tier}`;

// Schedule all 4 tiers for a new request
export async function scheduleNotificationTiers(requestId: number) {
  for (let i = 0; i < NOTIFICATION_TIERS.length; i++) {
    const { radiusKm, delayMinutes } = NOTIFICATION_TIERS[i];
    const tier = i + 1;
    const delay = delayMinutes * 60 * 1000;
    const id = tierJobId(requestId, tier);
    if (notificationQueue) {
      await notificationQueue.add('dispatch', { requestId, tier, radiusKm }, { delay, jobId: id });
    } else {
      memoryTimers.set(
        id,
        setTimeout(() => {
          memoryTimers.delete(id);
          dispatchNotificationTier(requestId, radiusKm, tier).catch((err) =>
            console.error('[notifications] tier dispatch failed', err),
          );
        }, delay),
      );
    }
  }
}

// Cancel all pending tier jobs when a request is matched
export async function cancelNotificationTiers(requestId: number) {
  for (let i = 1; i <= NOTIFICATION_TIERS.length; i++) {
    const id = tierJobId(requestId, i);
    const timer = memoryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      memoryTimers.delete(id);
    }
    if (notificationQueue) {
      const job = await notificationQueue.getJob(id);
      if (job) await job.remove();
    }
  }
}
