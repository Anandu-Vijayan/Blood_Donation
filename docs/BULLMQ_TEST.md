# BullMQ + Upstash — end-to-end test plan

Use this checklist after `REDIS_URL` points at Upstash (**Connect → ioredis**). BullMQ is already implemented in [`notification.worker.ts`](../apps/api/src/workers/notification.worker.ts); these steps confirm it works.

---

## Prerequisites

| Item | Check |
|------|--------|
| API running | `npm run dev` (from repo root) |
| Supabase | `DATABASE_URL` set, migrations applied (`npm run migrate`) |
| Upstash | `REDIS_URL=rediss://default:...@....upstash.io:6379` |
| Firebase Admin | `FIREBASE_SERVICE_ACCOUNT_JSON` or dev credentials for token verify |
| Two Firebase users | **Recipient** + **Donor** (phone auth in your app, or test accounts) |

Set shell variables (replace tokens from your Firebase client after sign-in):

```bash
export API=http://localhost:3000
export RECIPIENT_TOKEN="<firebase-id-token-recipient>"
export DONOR_TOKEN="<firebase-id-token-donor>"
```

How to get a Firebase ID token: sign in on your mobile/web client → `auth().currentUser.getIdToken()` (or equivalent).

---

## Phase 1 — Redis connection (30 seconds)

```bash
curl -s "$API/health" | jq .
```

**Pass:**

```json
{
  "ok": true,
  "postgres": true,
  "redis": true
}
```

**Fail:** `"redis": false`, 503, or `WRONGPASS` in API logs → fix `REDIS_URL` ([UPSTASH.md](UPSTASH.md)).

---

## Phase 2 — Queue keys appear in Upstash (no push required)

This proves **BullMQ schedules jobs** into Redis when a blood request is created.

### 2a. Register recipient role

```bash
curl -s -X POST "$API/users/me" \
  -H "Authorization: Bearer $RECIPIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_donor":false,"is_recipient":true}'
```

### 2b. Create a blood request (triggers `scheduleNotificationTiers`)

Use coordinates near your test donors (example: Kochi):

```bash
curl -s -X POST "$API/requests" \
  -H "Authorization: Bearer $RECIPIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test Recipient",
    "blood_group": "O+",
    "units": 1,
    "hospital_name": "Test Hospital",
    "latitude": 9.9312,
    "longitude": 76.2673,
    "urgency": "urgent",
    "requirement_type": "standby"
  }'
```

Note the returned `"id"` (e.g. `1`) — use it as `REQUEST_ID` below.

### 2c. Verify in Upstash Console

1. [Upstash](https://console.upstash.com) → **blood-Donation** → **Data Browser**
2. Search keys: `bull:notifications`

**Pass:** Keys exist, e.g.:

- `bull:notifications:meta`
- `bull:notifications:delayed` (tiers 2–4 with delays)
- `bull:notifications:wait` or job keys for tier 1

**Pass:** **Metrics** → command count increased after step 2b.

If no keys appear, Redis is connected but scheduling failed — check API logs for errors on `POST /requests`.

---

## Phase 3 — Worker runs tier 1 (optional: fake push token)

Tier 1 runs **immediately** (0 min delay). The worker only sends push if donors have valid Expo push tokens.

### 3a. Register donor (same blood group, near hospital)

Donor must be within **5 km** of the request hospital for tier 1. Use the **same coordinates** as the request for a guaranteed match:

```bash
curl -s -X POST "$API/users/me" \
  -H "Authorization: Bearer $DONOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_donor":true,"is_recipient":false}'

curl -s -X POST "$API/donors" \
  -H "Authorization: Bearer $DONOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "blood_group": "O+",
    "latitude": 9.9312,
    "longitude": 76.2673,
    "full_name": "Test Donor",
    "availability": true
  }'
```

### 3b. Register push token (Expo format)

Use a valid-format Expo token (real device token for real push; fake format for queue/log testing only):

```bash
curl -s -X POST "$API/donors/me/push-token" \
  -H "Authorization: Bearer $DONOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"}'
```

### 3c. Create another request (or wait if tier 1 already ran)

Create a **new** request (Phase 2b) **after** the donor exists so tier 1 can find them.

### 3d. Verify in Supabase

In Supabase **SQL Editor**:

```sql
SELECT * FROM notifications_log ORDER BY sent_at DESC LIMIT 10;
SELECT id, status, last_tier_radius_km FROM blood_requests ORDER BY id DESC LIMIT 5;
```

**Pass:**

- Row in `notifications_log` for your `request_id` + `donor_id`
- `blood_requests.last_tier_radius_km` updated (e.g. `5` after tier 1)

---

## Phase 4 — Cancel pending jobs on match

When a donor accepts a request, pending tier jobs should be removed from Redis.

```bash
export REQUEST_ID=1

curl -s -X POST "$API/requests/$REQUEST_ID/accept" \
  -H "Authorization: Bearer $DONOR_TOKEN" \
  -H "Content-Type: application/json"
```

In Upstash **Data Browser**, delayed jobs for `request-${REQUEST_ID}-tier-2` … `tier-4` should be **gone** (or reduced).

In Supabase:

```sql
SELECT status FROM blood_requests WHERE id = 1;
-- expected: matched
```

---

## Phase 5 — Delayed tiers (optional, slow test)

Default delays from [`constants.ts`](../apps/api/src/lib/constants.ts):

| Tier | Delay | Radius |
|------|-------|--------|
| 1 | 0 min | 5 km |
| 2 | 15 min | 15 km |
| 3 | 60 min | 50 km |
| 4 | 180 min | region-wide |

Leave the API running and re-check `notifications_log` after 15+ minutes, or temporarily lower delays in code for local testing only (not for production).

---

## Quick reference — API calls

| Step | Method | Path | Auth |
|------|--------|------|------|
| Health | `GET` | `/health` | None |
| Set roles | `POST` | `/users/me` | Bearer |
| Register donor | `POST` | `/donors` | Bearer |
| Push token | `POST` | `/donors/me/push-token` | Bearer |
| Create request | `POST` | `/requests` | Bearer (recipient) |
| Accept request | `POST` | `/requests/:id/accept` | Bearer (donor) |

All authenticated routes: `Authorization: Bearer <Firebase ID token>`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/health` redis false | Bad `REDIS_URL` | Upstash → Connect → **ioredis** |
| No `bull:*` keys | Request not created or Redis down | Phase 2b + check logs |
| Keys exist, no `notifications_log` | No donor in radius / wrong blood group / no push token | Phase 3, match `blood_group`, same lat/lng |
| `WRONGPASS` in logs | Placeholder password | Replace `YOUR_UPSTASH_PASSWORD` |
| Tier 2+ never runs | API stopped (Render free sleep) | Keep process alive or upgrade Render |
| Accept does not clear jobs | Wrong `REQUEST_ID` or already matched | Check `blood_requests.status` |

---

## Production (Render)

Same flow; replace `API`:

```bash
export API=https://your-service.onrender.com
curl -s "$API/health"
```

Ensure Render **Environment** has the same `REDIS_URL` as local.

---

## Related docs

- [UPSTASH.md](UPSTASH.md) — connection setup
- [RENDER.md](RENDER.md) — deploy API
- [SUPABASE.md](SUPABASE.md) — database setup
