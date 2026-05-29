CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  clerk_user_id   TEXT UNIQUE NOT NULL,
  is_donor        BOOLEAN NOT NULL DEFAULT FALSE,
  is_recipient    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donors (
  id              SERIAL PRIMARY KEY,
  clerk_user_id   TEXT UNIQUE NOT NULL REFERENCES users(clerk_user_id),
  blood_group     TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  location        GEOMETRY(Point, 4326),
  availability    BOOLEAN NOT NULL DEFAULT TRUE,
  push_token      TEXT,
  last_donated_at TIMESTAMPTZ,
  donation_count  INT NOT NULL DEFAULT 0,
  phone_encrypted TEXT NOT NULL,
  phone_iv        TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donors_location_idx ON donors USING GIST (location);

CREATE TABLE IF NOT EXISTS blood_requests (
  id                  SERIAL PRIMARY KEY,
  recipient_clerk_id  TEXT NOT NULL REFERENCES users(clerk_user_id),
  blood_group         TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units               INT NOT NULL CHECK (units > 0),
  hospital_name       TEXT NOT NULL,
  hospital_location   GEOMETRY(Point, 4326) NOT NULL,
  urgency             TEXT NOT NULL CHECK (urgency IN ('critical','urgent','normal')),
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','fulfilled','unfulfilled')),
  last_tier_radius_km INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blood_requests_location_idx ON blood_requests USING GIST (hospital_location);

CREATE TABLE IF NOT EXISTS notifications_log (
  id          SERIAL PRIMARY KEY,
  request_id  INT NOT NULL REFERENCES blood_requests(id),
  donor_id    INT NOT NULL REFERENCES donors(id),
  tier        INT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, donor_id)
);

CREATE TABLE IF NOT EXISTS handshakes (
  id           SERIAL PRIMARY KEY,
  request_id   INT UNIQUE NOT NULL REFERENCES blood_requests(id),
  donor_id     INT NOT NULL REFERENCES donors(id),
  matched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS donations (
  id          SERIAL PRIMARY KEY,
  donor_id    INT NOT NULL REFERENCES donors(id),
  request_id  INT REFERENCES blood_requests(id),
  blood_group TEXT NOT NULL,
  donated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
