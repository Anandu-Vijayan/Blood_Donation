import { sql } from './client.js';
import { KERALA_HOSPITALS, MAJOR_INDIAN_HOSPITALS } from '@blood-donation/shared';

export async function migrate() {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      firebase_uid    TEXT UNIQUE NOT NULL,
      is_donor        BOOLEAN NOT NULL DEFAULT FALSE,
      is_recipient    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS donors (
      id              SERIAL PRIMARY KEY,
      firebase_uid    TEXT UNIQUE NOT NULL REFERENCES users(firebase_uid),
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
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS donors_location_idx ON donors USING GIST (location)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blood_requests (
      id                  SERIAL PRIMARY KEY,
      recipient_firebase_uid TEXT NOT NULL REFERENCES users(firebase_uid),
      blood_group         TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
      units               INT NOT NULL CHECK (units > 0),
      hospital_name       TEXT NOT NULL,
      hospital_location   GEOMETRY(Point, 4326) NOT NULL,
      urgency             TEXT NOT NULL CHECK (urgency IN ('critical','urgent','normal')),
      requirement_type    TEXT NOT NULL DEFAULT 'standby' CHECK (requirement_type IN ('specific', 'standby', 'replacement')),
      requirement_date    TIMESTAMPTZ,
      status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','fulfilled','unfulfilled')),
      last_tier_radius_km INT NOT NULL DEFAULT 0,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS blood_requests_location_idx ON blood_requests USING GIST (hospital_location)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications_queue (
      id            SERIAL PRIMARY KEY,
      request_id    INT NOT NULL REFERENCES blood_requests(id),
      tier_index    INT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      scheduled_for TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE blood_requests 
    ADD COLUMN IF NOT EXISTS requirement_type TEXT NOT NULL DEFAULT 'standby' CHECK (requirement_type IN ('specific', 'standby', 'replacement')),
    ADD COLUMN IF NOT EXISTS requirement_date TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id          SERIAL PRIMARY KEY,
      request_id  INT NOT NULL REFERENCES blood_requests(id),
      donor_id    INT NOT NULL REFERENCES donors(id),
      tier        INT NOT NULL,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id, donor_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS handshakes (
      id          SERIAL PRIMARY KEY,
      request_id  INT UNIQUE NOT NULL REFERENCES blood_requests(id),
      donor_id    INT NOT NULL REFERENCES donors(id),
      matched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS donations (
      id          SERIAL PRIMARY KEY,
      donor_id    INT NOT NULL REFERENCES donors(id),
      request_id  INT REFERENCES blood_requests(id),
      blood_group TEXT NOT NULL,
      donated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // --- Hospitals table ---
  await sql`
    CREATE TABLE IF NOT EXISTS hospitals (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      city        TEXT NOT NULL,
      district    TEXT NOT NULL DEFAULT '',
      latitude    DOUBLE PRECISION NOT NULL,
      longitude   DOUBLE PRECISION NOT NULL,
      location    GEOMETRY(Point, 4326)
                    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
      is_custom   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hospitals_location_idx ON hospitals USING GIST (location)
  `;

  // Unique on lowercase name + city to avoid duplicates
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS hospitals_name_city_idx
      ON hospitals (LOWER(name), LOWER(city))
  `;

  // Seed hospitals from shared package (idempotent)
  const allHospitals = [...KERALA_HOSPITALS, ...MAJOR_INDIAN_HOSPITALS];
  for (const h of allHospitals) {
    await sql`
      INSERT INTO hospitals (name, city, district, latitude, longitude, is_custom)
      VALUES (${h.name}, ${h.city}, ${h.district}, ${h.latitude}, ${h.longitude}, FALSE)
      ON CONFLICT (LOWER(name), LOWER(city)) DO NOTHING
    `;
  }
}
