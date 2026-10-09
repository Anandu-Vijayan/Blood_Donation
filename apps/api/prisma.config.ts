import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// This file's own folder, computed without relying on the CommonJS-only
// `__dirname` (unavailable in ES modules, which this project uses).
const here = dirname(fileURLToPath(import.meta.url));

// This project keeps exactly one .env file, at the repo root — never one
// per package. Load it explicitly so `prisma` CLI commands see the same
// DATABASE_URL the running app does, regardless of which folder a command
// happens to be invoked from.
config({ path: resolve(here, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // This file is read only by Prisma's CLI (db pull, migrate, generate,
    // validate) — never by the running app. Every one of those operations
    // needs one continuous connection, so this always points at the
    // Supabase session pooler (DIRECT_DATABASE_URL), not the transaction
    // pooler DATABASE_URL — that one recycles connections mid-operation
    // and breaks CLI commands (Error P1017). The app's own runtime
    // connection, using DATABASE_URL, is wired up separately in
    // application code, later, and is unaffected by this file.
    url: process.env["DIRECT_DATABASE_URL"],
  },
});
