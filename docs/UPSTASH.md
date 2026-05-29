# Upstash Redis setup (free tier)

Your API uses **BullMQ** + **ioredis**. They need the **Redis protocol** URL (`rediss://...`), not the HTTP REST API.

| Upstash shows | Use for this API? |
|---------------|-------------------|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | No — only for `@upstash/redis` HTTP client |
| **ioredis** / **Redis URL** (`rediss://default:...@....upstash.io:6379`) | **Yes** — set as `REDIS_URL` |

---

## Step 1 — Get the correct connection string

1. Open [Upstash Console](https://console.upstash.com) → database **blood-Donation**
2. Click **Connect**
3. Open the **ioredis** tab (not "REST")
4. Copy the connection string. It looks like:

```
rediss://default:AbCdEf123456...@normal-sheepdog-67983.upstash.io:6379
```

5. That entire string is your `REDIS_URL`.

The host `normal-sheepdog-67983.upstash.io` matches your database; the **password** in `rediss://` is different from the REST token shown on the `.env` tab.

---

## Step 2 — Local `.env`

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
REDIS_URL=rediss://default:YOUR_PASSWORD@normal-sheepdog-67983.upstash.io:6379
DATABASE_URL=postgresql://...supabase...
ENCRYPTION_KEY=<64 hex chars>
```

Test Redis:

```bash
npm run dev
# In another terminal:
curl http://localhost:3000/health
```

Expected: `"redis":true`

---

## Step 3 — Render production

1. **reddar-api** → **Environment**
2. Add:

| Key | Value |
|-----|--------|
| `REDIS_URL` | Full `rediss://...` string from Upstash **ioredis** tab |
| `DATABASE_URL` | Supabase Session pooler URI |
| `ENCRYPTION_KEY` | 64 hex chars |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin JSON (one line) |
| `NODE_ENV` | `production` |
| `RUN_MIGRATIONS_ON_START` | `true` then `false` |

3. **Do not** add Render Redis if you use Upstash — one `REDIS_URL` is enough.
4. **Manual Deploy**

---

## Step 4 — Verify notifications queue

1. `GET https://your-api.onrender.com/health` → `"redis":true`
2. Create a blood request (authenticated) → API schedules BullMQ jobs in Upstash
3. Upstash Console → **blood-Donation** → **Data Browser** — you may see BullMQ keys like `bull:notifications:*`

---

## Free tier limits (Upstash)

| Limit | Typical free tier |
|-------|-------------------|
| Storage | 256 MB |
| Commands | 10k / day (check your console) |
| Region | Mumbai (`ap-south-1`) — good for India |

If you hit command limits, upgrade Upstash or reduce notification tests.

---

## Security — important

- **Never commit** `REDIS_URL`, REST token, or password to GitHub
- If a token was shared in chat or committed, **rotate it**: Upstash → database → **Settings** → reset credentials
- Set variables only in Render **Environment** or local `apps/api/.env` (gitignored)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `UPSTASH_REDIS_REST_* is for HTTP client only` | Use `REDIS_URL` from **ioredis** tab, not REST vars |
| `/health` redis false | Wrong password; recopy from ioredis tab |
| `ETIMEDOUT` / connection refused | Use `rediss://` not `https://`; port must be **6379** |
| BullMQ jobs not running | Check `/health`; ensure API process stays up (Render free cold start) |
| TLS errors | URL must start with `rediss://` |

---

## Architecture

```
Render API (reddar-api)
    ├── DATABASE_URL  → Supabase Postgres
    └── REDIS_URL     → Upstash (BullMQ notification tiers)
```

No Render Redis required when using Upstash.

---

## Related docs

- [BULLMQ_TEST.md](BULLMQ_TEST.md) — step-by-step API calls to verify BullMQ end-to-end
- [RENDER.md](RENDER.md) — deploy API
- [SUPABASE.md](SUPABASE.md) — database setup
