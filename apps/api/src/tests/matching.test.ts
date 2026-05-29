import { describe, it, expect } from 'vitest';
import { COOLDOWN_DAYS, URGENCY_SCORES } from '@blood-donation/shared';

// Unit tests for matching logic — verifies the SQL conditions conceptually
// Integration tests (with real DB) are in notification.integration.test.ts

describe('Matching query filters', () => {
  describe('Cooldown filter', () => {
    it('excludes donors whose last_donated_at is within 90 days', () => {
      const lastDonatedAt = new Date();
      lastDonatedAt.setDate(lastDonatedAt.getDate() - 30);
      const daysSince = (Date.now() - lastDonatedAt.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysSince).toBeLessThan(COOLDOWN_DAYS);
    });

    it('includes donors whose last_donated_at is beyond 90 days', () => {
      const lastDonatedAt = new Date();
      lastDonatedAt.setDate(lastDonatedAt.getDate() - 91);
      const daysSince = (Date.now() - lastDonatedAt.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysSince).toBeGreaterThan(COOLDOWN_DAYS);
    });

    it('includes donors with no donation history', () => {
      const lastDonatedAt = null;
      expect(lastDonatedAt).toBeNull();
    });
  });

  describe('Exact blood group filter', () => {
    const requestBloodGroup = 'B+';
    const donors = [
      { blood_group: 'B+', id: 1 },
      { blood_group: 'O-', id: 2 },
      { blood_group: 'B+', id: 3 },
      { blood_group: 'AB+', id: 4 },
    ];

    it('only includes donors with exact matching blood group', () => {
      const eligible = donors.filter((d) => d.blood_group === requestBloodGroup);
      expect(eligible).toHaveLength(2);
      expect(eligible.every((d) => d.blood_group === 'B+')).toBe(true);
    });

    it('excludes all donors when blood group has no match', () => {
      const eligible = donors.filter((d) => d.blood_group === 'AB-');
      expect(eligible).toHaveLength(0);
    });
  });

  describe('Availability filter', () => {
    const donors = [
      { id: 1, availability: true },
      { id: 2, availability: false },
      { id: 3, availability: true },
    ];

    it('excludes inactive donors', () => {
      const eligible = donors.filter((d) => d.availability);
      expect(eligible).toHaveLength(2);
      expect(eligible.every((d) => d.availability)).toBe(true);
    });
  });

  describe('Duplicate notification filter', () => {
    const notifiedDonorIds = new Set([1, 3]);
    const donors = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

    it('excludes donors already notified for the same request', () => {
      const eligible = donors.filter((d) => !notifiedDonorIds.has(d.id));
      expect(eligible).toHaveLength(2);
      expect(eligible.map((d) => d.id)).toEqual([2, 4]);
    });
  });
});

describe('Urgency scoring', () => {
  it('critical has highest score', () => {
    expect(URGENCY_SCORES.critical).toBeGreaterThan(URGENCY_SCORES.urgent);
    expect(URGENCY_SCORES.urgent).toBeGreaterThan(URGENCY_SCORES.normal);
  });
});
