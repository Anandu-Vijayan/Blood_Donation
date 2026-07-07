import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  connectionString.includes('supabase.com') ||
  connectionString.includes('sslmode=require');

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: useSsl ? 'require' : undefined,
  prepare: connectionString.includes('pgbouncer=true') ? false : undefined,
  onnotice: (notice) => {
    if (notice.severity !== 'NOTICE') {
      console.warn(notice);
    }
  },
});
