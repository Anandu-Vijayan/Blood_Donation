import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';

export { Prisma };

// This pg version treats `sslmode=require` in the connection string as full
// certificate-chain verification, which fails against Supabase's cert
// ("self-signed certificate in certificate chain"). Passing a separate
// `ssl` option alongside `connectionString` did NOT override this —
// pg's own connection-string parsing wins regardless. The fix pg's own
// warning names is `uselibpqcompat=true` in the connection string itself,
// restoring the traditional, looser require-encryption-only behavior
// (equivalent to ssl: 'require').
function withLibpqCompat(url: string): string {
  if (!url) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('uselibpqcompat', 'true');
  return parsed.toString();
}

// Proactively close idle connections ourselves before Supabase's side
// does, rather than risk reusing one it already killed (observed as
// ECONNRESET on a request after a few idle minutes).
const adapter = new PrismaPg(
  {
    connectionString: withLibpqCompat(process.env.DATABASE_URL || ''),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  },
  {
    onPoolError: (err) => {
      console.error('[prisma] pg pool error:', err.message);
    },
  },
);

export const prisma = new PrismaClient({ adapter });

// Prisma's singular `update()`/`delete()` throw (code P2025) when the
// `where` matches no row, unlike raw SQL's UPDATE/DELETE ... WHERE, which
// silently affects zero rows. Routes that want the old "404 if missing"
// behavior wrap the call in this instead of a bare try/catch each time.
export async function updateOrNull<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return null;
    }
    throw err;
  }
}
