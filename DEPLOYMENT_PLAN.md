# Deployment Plan — Blood Donation

Target: GitHub (source + CI) → DigitalOcean Droplet (single-host docker compose) for the API, EAS for the mobile app.

## Architecture

```
GitHub push (main)
  └─► GitHub Actions: build API Docker image → push to GHCR
        └─► SSH into Droplet → docker compose pull && up -d

GitHub tag (v*)
  └─► GitHub Actions: eas build --platform android (Expo cloud)

Droplet (Ubuntu 24.04, $12/mo, 2GB RAM)
  ├─ caddy        (:80, :443 — auto Let's Encrypt)
  ├─ api          (Node, internal :3000)
  ├─ postgres     (PostGIS 16, internal only, named volume)
  └─ redis        (internal only)
```

## Cost estimate

| Item | Monthly |
|---|---|
| DO Droplet (2GB / 1 vCPU regular) | $12 |
| DO weekly snapshots (optional) | $1.20 |
| Domain (annualized) | ~$1 |
| GHCR | free |
| GitHub Actions (public/private under 2k min) | free |
| EAS Build free tier (or $19 hobby) | $0–19 |
| **Total** | **~$13–33** |

Compare to App Platform equivalent: ~$30–45 (API instance + managed Postgres + managed Redis).

## Files to add to the repo

1. `.github/workflows/api-deploy.yml` — build & push image to GHCR, then SSH deploy.
2. `.github/workflows/mobile-build.yml` — EAS build on tag push.
3. `deploy/docker-compose.prod.yml` — prod stack (API image from GHCR, no exposed DB ports, restart=always).
4. `deploy/Caddyfile` — reverse proxy with automatic TLS.
5. `deploy/.env.example` — required environment variables.
6. `deploy/README.md` — one-time Droplet bootstrap steps.

## GitHub secrets required

| Secret | Purpose |
|---|---|
| `DO_HOST` | Droplet IP or hostname |
| `DO_USER` | Deploy user (e.g. `deploy`) |
| `DO_SSH_KEY` | Private SSH key for deploy user |
| `EXPO_TOKEN` | EAS authentication |

`GITHUB_TOKEN` is auto-provided for GHCR push — no setup.

## One-time Droplet bootstrap (~15 min)

1. Create $12 Droplet, Ubuntu 24.04, in nearest region (BLR1 for India).
2. Point `api.yourdomain.com` A record at the Droplet IP.
3. SSH in as root:
   ```bash
   apt update && apt install -y docker.io docker-compose-plugin
   adduser --disabled-password deploy
   usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh
   ```
4. Add the GitHub Actions deploy public key to `/home/deploy/.ssh/authorized_keys`.
5. As `deploy` user: create `/opt/blood-donation/`, copy `docker-compose.prod.yml`, `Caddyfile`, and `.env`.
6. `docker login ghcr.io -u <github-user>` with a PAT (read:packages scope).
7. `docker compose -f docker-compose.prod.yml up -d`. Verify Caddy gets a cert and `https://api.yourdomain.com/health` responds.

After this, every push to `main` deploys automatically.

## Mobile env update

`apps/mobile/.env` → set `EXPO_PUBLIC_API_URL=https://api.yourdomain.com` for production builds. Use EAS profiles (`production` vs `development`) so dev builds keep pointing at LAN/tunnel.

## Tradeoffs / things to revisit later

- **Single Droplet = ~5–10s downtime per deploy.** Fine pre-launch. Add blue-green or App Platform when uptime matters.
- **Postgres on the Droplet has no backup by default.** Enable DO weekly snapshots ($1.20/mo) on day one. Migrate to DO Managed Postgres (~$15/mo) once user data is real.
- **Migrations auto-run on API boot** (per project CLAUDE.md). Convenient, but a bad migration brings the API down. Before launch, gate migrations behind a manual workflow_dispatch step.
- **No staging environment** in this plan. Add a second Droplet + `staging` branch workflow when the team grows.
- **Secrets in `.env` on disk.** OK for now. Move to DO's "App Spec" or HashiCorp Vault if compliance comes up.

## Pre-flight checklist (before writing the workflow files)

- [ ] DO credentials received from colleague
- [ ] Droplet created and `ssh deploy@droplet` works
- [ ] Domain pointed at Droplet IP, DNS propagated
- [ ] GitHub repo created, code pushed
- [ ] Decided: EAS Build cloud (paid above free tier) vs local `eas build --local`
- [ ] Decided: production database password, Clerk production keys, any other prod secrets
- [ ] Confirmed migration strategy (auto-on-boot vs manual gate)

Once the checklist is green, the six files above can be generated and the first deploy run.
