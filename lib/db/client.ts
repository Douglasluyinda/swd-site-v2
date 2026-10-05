// Database client — PostgreSQL via postgres.js.
//
// DATABASE_URL should point at any Postgres instance: local for dev,
// a managed provider (Neon, Supabase, Vercel Postgres, RDS, etc.) for
// production. Connection pooling: postgres.js pools internally; for
// serverless (Vercel), prefer a provider with a pooled/serverless-friendly
// connection string (e.g. Neon's "-pooler" host) to avoid exhausting
// connections across many concurrent function invocations.

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Set it to a Postgres connection string " +
      "(e.g. postgres://user:pass@host:5432/dbname).",
  );
}

const client = postgres(process.env.DATABASE_URL, {
  // A conservative default for serverless; raise for a long-lived server.
  max: process.env.NODE_ENV === "production" ? 1 : 10,
});

export const db = drizzle(client, { schema });
