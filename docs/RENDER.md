# Deploy the API on Render.com (free tier)

**Database:** [Supabase](SUPABASE.md)  
**Redis:** [Upstash](UPSTASH.md) (free)  
**API:** Render Web Service (free, Docker)

---

## Architecture

```
Client → https://reddar-api.onrender.com (Render Web)
              ├── DATABASE_URL → Supabase Postgres + PostGIS
              └── REDIS_URL    → Upstash Redis (BullMQ)
```

---

## Step 1 — Supabase (database)

Follow **[docs/SUPABASE.md](SUPABASE.md)**:

1. Create project → enable **PostGIS**
2. Copy **Session pooler** `DATABASE_URL`
3. Run `npm run migrate` locally once (optional but recommended)

---

## Step 2 — Upstash Redis

Follow **[docs/UPSTASH.md](UPSTASH.md)** — copy `REDIS_URL` from Upstash **Connect → ioredis** (not REST).

## Step 3 — Render Blueprint

1. Push repo to GitHub
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect repo → creates **reddar-api** only (no Render Postgres, no Render Redis)

---

## Step 4 — Environment variables

Open **reddar-api** → **Environment** → add:

| Variable | Required | Example / source |
|----------|----------|------------------|
| `DATABASE_URL` | Yes | Supabase Session pooler URI |
| `REDIS_URL` | Yes | Upstash `rediss://...` from [UPSTASH.md](UPSTASH.md) |
| `ENCRYPTION_KEY` | Yes | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Firebase Admin JSON, one line |
| `NODE_ENV` | Yes | `production` |
| `RUN_MIGRATIONS_ON_START` | First deploy | `true`, then `false` |
| `CORS_ORIGINS` | If you have a client | `https://yourapp.com` |
| `EXPO_ACCESS_TOKEN` | Optional | Expo push |

**Do not set `PORT`** — Render injects it.

---

## Step 5 — Deploy and verify

1. **Manual Deploy** after saving env vars
2. Open `https://reddar-api.onrender.com/health` (your URL may differ)

```json
{"ok":true,"postgres":true,"redis":true}
```

---

## Free tier limits (Render)

| Service | Limit |
|---------|--------|
| Web API | Sleeps after **15 min** idle; ~30–60 s cold start |
| Instance hours | **750 h/month** per workspace |

Redis limits are on **Upstash free tier** — see [UPSTASH.md](UPSTASH.md).

**Supabase free** handles the database (no 30-day Render Postgres deletion). See [SUPABASE.md](SUPABASE.md).

---

## Manual setup (without Blueprint)

### Web service

| Setting | Value |
|---------|--------|
| Runtime | Docker |
| Dockerfile | `apps/api/Dockerfile` |
| Context | `.` |
| Health check | `/health` |

Paste all env vars from Step 3 above.

---

## Security

| Do | Don't |
|----|--------|
| Secrets in Render **Environment** only | Commit `.env` or Supabase password to git |
| Supabase pooler URL on Render | Expose DB in `render.yaml` |
| Rotate keys in Supabase dashboard if leaked | Share service account JSON publicly |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails | Check Docker logs on web service |
| `/health` 503 postgres | Check `DATABASE_URL`, PostGIS enabled, `?sslmode=require` |
| `/health` 503 redis | Check `REDIS_URL` is **Internal** URL from Render Redis |
| Auth 401 | Set `FIREBASE_SERVICE_ACCOUNT_JSON` |
| Slow first request | Free web tier cold start — normal |

---

## Upgrade path

| When | Upgrade |
|------|---------|
| API always slow to wake | Render Web → Starter (~$7/mo) |
| More DB storage / no pause | Supabase Pro |
| Redis full | Render Redis Starter |
