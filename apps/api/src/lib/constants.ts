export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export type RequestStatus = 'open' | 'matched' | 'fulfilled' | 'unfulfilled';
export type UrgencyLevel = 'critical' | 'urgent' | 'normal';

export const COOLDOWN_DAYS = 90;
export const MATCH_CANCEL_WINDOW_MINUTES = 30;

export const NOTIFICATION_TIERS = [
  { radiusKm: 5,    delayMinutes: 0   },
  { radiusKm: 15,   delayMinutes: 15  },
  { radiusKm: 50,   delayMinutes: 60  },
  { radiusKm: 9999, delayMinutes: 180 },
] as const;
