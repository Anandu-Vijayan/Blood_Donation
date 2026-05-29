# Blood Donation API — Dev Setup

Backend monorepo: `apps/api` (Fastify + Postgres/PostGIS + Redis), `packages/shared`.

## Prereqs

- `.npmrc` at repo root has `legacy-peer-deps=true` (only if you add frontend deps later).
- Local: `docker compose up -d postgres redis` OR use Supabase `DATABASE_URL` in root `.env`
- Production DB: Supabase; Redis: Upstash; env file: **repo root `.env`**
- Migrations: `npm run migrate` or `RUN_MIGRATIONS_ON_START=true` in root `.env`

## Run

```bash
docker compose up -d postgres redis
npm run dev    # listens on 0.0.0.0:3000
```

Env file: **repo root `.env`** (copy from `.env.example` — never commit).

## Deploy

See [docs/RENDER.md](docs/RENDER.md) for Render.com hosting.

## Known gotchas

- **PostGIS**: migration runs `CREATE EXTENSION postgis`; on some hosts run manually in DB shell.
- **ENCRYPTION_KEY**: must be exactly 64 hex characters.
- **Firebase**: production needs `FIREBASE_SERVICE_ACCOUNT_JSON` matching the client Firebase project.
