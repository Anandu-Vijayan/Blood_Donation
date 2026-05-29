import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be hexadecimal')
    .refine((v) => !/REPLACE|CHANGE_ME|YOUR_KEY/i.test(v), {
      message: 'ENCRYPTION_KEY must not be a placeholder — generate a unique key',
    }),
  CORS_ORIGINS: z.string().optional(),
  RUN_MIGRATIONS_ON_START: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function getCorsOrigins(config: AppConfig): boolean | string[] {
  if (config.NODE_ENV === 'development' && !config.CORS_ORIGINS) {
    return true;
  }
  if (!config.CORS_ORIGINS) {
    return false;
  }
  return config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
}
