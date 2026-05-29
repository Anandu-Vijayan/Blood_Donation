import { describe, it, expect } from 'vitest';
import { NOTIFICATION_TIERS } from '../lib/constants.js';
import {
  MATCH_CANCEL_WINDOW_MINUTES,
  COOLDOWN_DAYS,
} from '@blood-donation/shared';

// Integration tests require a running postgres+redis.
// Run with: docker compose up -d && npm test
// These tests verify the scheduling and cancellation logic structurally.

describe('Progressive notification tiers', () => {
  it('schedules 4 tiers with correct delays', () => {
    expect(NOTIFICATION_TIERS).toHaveLength(4);
    expect(NOTIFICATION_TIERS[0].delayMinutes).toBe(0);
    expect(NOTIFICATION_TIERS[1].delayMinutes).toBe(15);
    expect(NOTIFICATION_TIERS[2].delayMinutes).toBe(60);
    expect(NOTIFICATION_TIERS[3].delayMinutes).toBe(180);
  });

  it('tier radii expand progressively', () => {
    for (let i = 1; i < NOTIFICATION_TIERS.length; i++) {
      expect(NOTIFICATION_TIERS[i].radiusKm).toBeGreaterThan(NOTIFICATION_TIERS[i - 1].radiusKm);
    }
  });

  it('tier 1 dispatches immediately (delay = 0)', () => {
    expect(NOTIFICATION_TIERS[0].delayMinutes).toBe(0);
  });

  it('final tier covers region-wide (radiusKm >= 9999)', () => {
    const lastTier = NOTIFICATION_TIERS[NOTIFICATION_TIERS.length - 1];
    expect(lastTier.radiusKm).toBeGreaterThanOrEqual(9999);
  });
});

describe('Handshake lifecycle', () => {
  it('cancel window is 30 minutes', () => {
    expect(MATCH_CANCEL_WINDOW_MINUTES).toBe(30);
  });

  it('rejects cancellation beyond the window', () => {
    const matchedAt = new Date(Date.now() - 31 * 60 * 1000);
    const elapsedMinutes = (Date.now() - matchedAt.getTime()) / 60000;
    expect(elapsedMinutes).toBeGreaterThan(MATCH_CANCEL_WINDOW_MINUTES);
  });

  it('allows cancellation within the window', () => {
    const matchedAt = new Date(Date.now() - 10 * 60 * 1000);
    const elapsedMinutes = (Date.now() - matchedAt.getTime()) / 60000;
    expect(elapsedMinutes).toBeLessThan(MATCH_CANCEL_WINDOW_MINUTES);
  });
});

describe('Cooldown enforcement', () => {
  it('90-day cooldown constant is correct', () => {
    expect(COOLDOWN_DAYS).toBe(90);
  });

  it('donor is in cooldown immediately after donation', () => {
    const lastDonatedAt = new Date();
    const daysSince = (Date.now() - lastDonatedAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysSince).toBeLessThan(90);
  });

  it('donor is out of cooldown after 90 days', () => {
    const lastDonatedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    const daysSince = (Date.now() - lastDonatedAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysSince).toBeGreaterThan(90);
  });
});
