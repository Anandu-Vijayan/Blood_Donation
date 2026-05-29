# Supabase database setup

The API uses **Supabase** for PostgreSQL + PostGIS. **Redis** stays on Render (BullMQ).

```
Mobile/Web client → Render API (reddar-api) → Supabase Postgres
                              ↓
                        Render Redis
```

---

## 1. Create Supabase project

1. [supabase.com](https://supabase.com) → **New project**
2. Choose region close to your users (e.g. Mumbai / Singapore for India)
3. Save the **database password** (shown once)

---

## 2. Enable PostGIS

**Option A — Dashboard**

1. **Database** → **Extensions**
2. Search **postgis** → **Enable**

**Option B — SQL Editor**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

The API migration also runs this, but enabling it first avoids deploy errors.

---

## 3. Get `DATABASE_URL`

1. **Project Settings** → **Database**
2. Under **Connection string**, choose **URI**
3. Use **Session pooler** (recommended for Render’s always-on Node process):

   - Host like `aws-0-<region>.pooler.supabase.com`
   - Port **5432**
   - Mode: **Session**

4. Replace `[YOUR-PASSWORD]` with your DB password.

Example shape:

```
postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

**For first migration only**, you can use the **Direct** connection (host `db.<ref>.supabase.co`) if the pooler blocks DDL; switch back to Session pooler after.

Append if not present:

```
?sslmode=require
```

---

## 4. Run migrations

**Locally** (good first test):

```bash
# apps/api/.env
DATABASE_URL=postgresql://postgres.xxx:PASSWORD@....pooler.supabase.com:5432/postgres?sslmode=require
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=<64 hex chars>

npm run migrate
```

**On Render** — set `RUN_MIGRATIONS_ON_START=true` for the first deploy, then set to `false`.

---

## 5. Add to Render environment

**reddar-api** → **Environment**:

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Supabase Session pooler URI (with password) |
| `REDIS_URL` | Render **reddar-redis** internal URL |
| `ENCRYPTION_KEY` | 64 hex chars (generate locally) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin JSON (one line) |
| `NODE_ENV` | `production` |
| `RUN_MIGRATIONS_ON_START` | `true` then `false` |

Never commit `DATABASE_URL` to git.

---

## 6. Verify

```bash
curl https://reddar-api.onrender.com/health
```

```json
{"ok":true,"postgres":true,"redis":true}
```

In Supabase **Table Editor**, you should see tables: `users`, `donors`, `blood_requests`, `hospitals`, etc.

---

## Supabase + Render free tier notes

| Topic | Note |
|-------|------|
| **Supabase free DB** | 500 MB, pauses after 1 week inactive (reactivates on request) — better than Render’s 30-day Postgres delete |
| **Connection limits** | Use **pooler** URL, not direct, for the live API |
| **IPv4** | Render free may need Supabase **IPv4 add-on** or pooler (pooler usually works) |
| **Backups** | Enable in Supabase for anything you care about |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `SSL required` | Add `?sslmode=require` to URL (client also auto-enables SSL for `supabase.com`) |
| `extension "postgis" is not available` | Enable PostGIS in Supabase Extensions |
| `/health` postgres false | Wrong password, wrong pooler mode, or IP restricted — check Supabase **Database** settings |
| Migration timeout | Try **Direct** connection for `npm run migrate`, then use pooler for API |
| Too many connections | Use Session pooler; reduce `max` in `client.ts` if needed |

---

## Local dev: Supabase vs Docker

| | Docker (`docker compose`) | Supabase |
|--|---------------------------|----------|
| Use when | Offline, no cloud DB | Same DB as production |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/blood_donation` | Supabase URI from dashboard |

You can use Supabase for local dev by pointing `apps/api/.env` at the pooler URL (use a dev branch/project if available).
