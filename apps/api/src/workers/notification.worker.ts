import { Worker, Queue, Job } from 'bullmq';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { redis } from '../lib/redis.js';
import { sql } from '../db/client.js';
import { NOTIFICATION_TIERS, COOLDOWN_DAYS } from '../lib/constants.js';

export const notificationQueue = new Queue('notifications', { connection: redis });

const expo = new Expo();

let notificationWorker: Worker<NotificationJobData> | null = null;

interface NotificationJobData {
  requestId: number;
  tier: number;
  radiusKm: number;
}

// Queries eligible donors within radius, sends push notifications, logs to notifications_log
export async function dispatchNotificationTier(requestId: number, radiusKm: number, tier: number) {
  const [request] = await sql`
    SELECT id, blood_group, hospital_name,
           ST_X(hospital_location::geometry) AS lng,
           ST_Y(hospital_location::geometry) AS lat,
           urgency, status
    FROM blood_requests WHERE id = ${requestId}
  `;

  if (!request || request.status !== 'open') return;

  const regionWide = radiusKm >= 9999;

  // Eligible donors: exact blood group, active, not in cooldown, not already notified, has push token
  const donors = await sql`
    SELECT d.id, d.push_token, d.full_name
    FROM donors d
    WHERE d.blood_group = ${request.blood_group}
      AND d.availability = TRUE
      AND d.push_token IS NOT NULL
      AND (d.last_donated_at IS NULL OR d.last_donated_at < NOW() - INTERVAL '${sql(String(COOLDOWN_DAYS))} days')
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
    .filter((d) => Expo.isExpoPushToken(d.push_token))
    .map((d) => ({
      to: d.push_token,
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
    await sql`
      INSERT INTO notifications_log (request_id, donor_id, tier)
      SELECT ${requestId}, unnest(${donors.map((d) => d.id)}::int[]), ${tier}
      ON CONFLICT (request_id, donor_id) DO NOTHING
    `;
  }

  // Update last dispatched tier radius on the request
  await sql`UPDATE blood_requests SET last_tier_radius_km = ${radiusKm} WHERE id = ${requestId}`;
}

export function startNotificationWorker() {
  notificationWorker = new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { requestId, tier, radiusKm } = job.data;
      await dispatchNotificationTier(requestId, radiusKm, tier);
    },
    { connection: redis },
  );
  return notificationWorker;
}

export async function stopNotificationWorker() {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
  await notificationQueue.close();
}

// Schedule all 4 tiers for a new request
export async function scheduleNotificationTiers(requestId: number) {
  for (let i = 0; i < NOTIFICATION_TIERS.length; i++) {
    const { radiusKm, delayMinutes } = NOTIFICATION_TIERS[i];
    await notificationQueue.add(
      'dispatch',
      { requestId, tier: i + 1, radiusKm },
      {
        delay: delayMinutes * 60 * 1000,
        jobId: `request-${requestId}-tier-${i + 1}`,
      },
    );
  }
}

// Cancel all pending tier jobs when a request is matched
export async function cancelNotificationTiers(requestId: number) {
  for (let i = 1; i <= NOTIFICATION_TIERS.length; i++) {
    const job = await notificationQueue.getJob(`request-${requestId}-tier-${i}`);
    if (job) {
      await job.remove();
    }
  }
}
