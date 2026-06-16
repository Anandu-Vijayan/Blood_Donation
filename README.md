# REDDAR API — Blood Donation Backend

Fastify + PostgreSQL/PostGIS + Redis + Firebase Auth. **Backend only** (no mobile app in this repo).

## Stack

| Component | Technology |
|-----------|------------|
| API | [apps/api](apps/api) — Fastify 5 |
| Shared types | [packages/shared](packages/shared) |
| Database | [Supabase](docs/SUPABASE.md) PostgreSQL + PostGIS |
| Queue | [Upstash](docs/UPSTASH.md) Redis + BullMQ (push notification tiers) |
| Auth | Firebase ID tokens |

## Local development

### Prerequisites

- Node.js 22+
- Docker Desktop (Postgres + Redis)

### Setup

```bash
npm install
docker compose up -d postgres redis

cp .env.example .env
# Edit .env at repo root — set ENCRYPTION_KEY, DATABASE_URL, REDIS_URL, Firebase, etc.

npm run migrate
npm run dev
```

API: `http://localhost:3000`  
Health: `http://localhost:3000/health`

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment variables

See [.env.example](.env.example) at **repo root**. **Never commit `.env`.**

The API loads **root** `.env` only (not `apps/api/.env`).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase connection string (see [docs/SUPABASE.md](docs/SUPABASE.md)) |
| `REDIS_URL` | Yes | Upstash `rediss://...` URL ([docs/UPSTASH.md](docs/UPSTASH.md)) |
| `ENCRYPTION_KEY` | Yes | 64-character hex (32 bytes) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Prod | Firebase Admin JSON (path or inline) |
| `NODE_ENV` | Yes | `development` / `production` |
| `RUN_MIGRATIONS_ON_START` | Dev | `true` to auto-migrate on boot |
| `CORS_ORIGINS` | Prod | Comma-separated allowed origins |
| `PORT` | Auto | Render sets this in production |

## Deploy (Render free + Supabase)

| Piece | Where |
|-------|--------|
| Database | **Supabase** — [docs/SUPABASE.md](docs/SUPABASE.md) |
| Redis | **Upstash** — [docs/UPSTASH.md](docs/UPSTASH.md) |
| API | **Render** — [docs/RENDER.md](docs/RENDER.md) |

Quick steps:

1. Supabase: create project → enable PostGIS → copy `DATABASE_URL`
2. GitHub: push this repo
3. Upstash → copy `REDIS_URL` from **Connect → ioredis**
4. Render → **Blueprint** → [`render.yaml`](render.yaml)
5. **reddar-api** → Environment: `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`
5. Deploy → `https://<your-service>.onrender.com/health`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run built API |
| `npm run migrate` | Apply DB schema |
| `npm test` | Unit tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |

**Verify BullMQ + Upstash:** [docs/BULLMQ_TEST.md](docs/BULLMQ_TEST.md)

## API routes

| Prefix | Auth | Description |
|--------|------|-------------|
| `GET /health` | No | Postgres + Redis health |
| `GET /stats` | No | Platform statistics |
| `GET /dashboard/summary` | No | Same as `/stats` (alias) |
| `/users` | Firebase JWT | User profile & roles |
| `/donors` | Firebase JWT | Donor registration & profile |
| `/requests` | Firebase JWT | Blood requests & matching |
| `/hospitals` | No | Hospital search (public) |

## Security

- Secrets only in Render Environment or local `.env` (gitignored).
- Do not commit Firebase service account files or real `ENCRYPTION_KEY` values.
- Production requires Firebase Admin credentials.

## License

Private.
