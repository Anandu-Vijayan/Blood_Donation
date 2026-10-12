import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { prismaMock, authMock } = vi.hoisted(() => {
  const txModel = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
  const tx = {
    notifications_log: txModel,
    notifications_queue: txModel,
    handshakes: txModel,
    donations: txModel,
    blood_requests: txModel,
    donors: txModel,
    users: txModel,
  };
  return {
    prismaMock: {
      users: { findUnique: vi.fn() },
      donors: { findUnique: vi.fn().mockResolvedValue(null) },
      blood_requests: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      handshakes: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    },
    authMock: { deleteUser: vi.fn() },
  };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/firebase.js', () => ({ auth: authMock }));
vi.mock('../workers/notification.worker.js', () => ({ cancelNotificationTiers: vi.fn() }));

import { deleteUserAccount } from '../services/deleteUser.js';

describe('deleteUserAccount Firebase handling', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.donors.findUnique.mockResolvedValue(null);
    prismaMock.blood_requests.findMany.mockResolvedValue([]);
    prismaMock.handshakes.findMany.mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.mocked(console.error).mockRestore();
  });

  it('deletes DB rows then the Firebase account and returns true', async () => {
    prismaMock.users.findUnique.mockResolvedValue({ id: 1 });
    authMock.deleteUser.mockResolvedValue(undefined);

    await expect(deleteUserAccount('uid-1')).resolves.toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(authMock.deleteUser).toHaveBeenCalledWith('uid-1');
  });

  it('throws a 502 when Firebase deletion fails after the DB delete', async () => {
    prismaMock.users.findUnique.mockResolvedValue({ id: 1 });
    authMock.deleteUser.mockRejectedValue({ code: 'app/invalid-credential', message: 'no creds' });

    await expect(deleteUserAccount('uid-1')).rejects.toMatchObject({ statusCode: 502 });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('tolerates auth/user-not-found after the DB delete', async () => {
    prismaMock.users.findUnique.mockResolvedValue({ id: 1 });
    authMock.deleteUser.mockRejectedValue({ code: 'auth/user-not-found' });

    await expect(deleteUserAccount('uid-1')).resolves.toBe(true);
  });

  it('on retry (no DB user) still deletes the orphaned Firebase account', async () => {
    prismaMock.users.findUnique.mockResolvedValue(null);
    authMock.deleteUser.mockResolvedValue(undefined);

    await expect(deleteUserAccount('uid-1')).resolves.toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(authMock.deleteUser).toHaveBeenCalledWith('uid-1');
  });

  it('returns false when neither DB user nor Firebase account exists', async () => {
    prismaMock.users.findUnique.mockResolvedValue(null);
    authMock.deleteUser.mockRejectedValue({ code: 'auth/user-not-found' });

    await expect(deleteUserAccount('uid-1')).resolves.toBe(false);
  });

  it('retry surfaces a 502 if Firebase is still failing', async () => {
    prismaMock.users.findUnique.mockResolvedValue(null);
    authMock.deleteUser.mockRejectedValue({ code: 'app/invalid-credential' });

    await expect(deleteUserAccount('uid-1')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('skips Firebase for mock- users in development', async () => {
    process.env.NODE_ENV = 'development';
    prismaMock.users.findUnique.mockResolvedValue({ id: 1 });

    await expect(deleteUserAccount('mock-abc')).resolves.toBe(true);
    expect(authMock.deleteUser).not.toHaveBeenCalled();
  });

  it('does not skip Firebase for mock- uids outside development', async () => {
    prismaMock.users.findUnique.mockResolvedValue({ id: 1 });
    authMock.deleteUser.mockResolvedValue(undefined);

    await deleteUserAccount('mock-abc');
    expect(authMock.deleteUser).toHaveBeenCalledWith('mock-abc');
  });
});
