import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __firstlookPool: Pool | undefined;
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!global.__firstlookPool) {
    global.__firstlookPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return global.__firstlookPool;
}

export async function ensureSchema() {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS county_watches (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      county TEXT NOT NULL,
      state TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_fingerprint TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(email, county, state)
    );
    CREATE TABLE IF NOT EXISTS research_sessions (
      id UUID PRIMARY KEY,
      email TEXT,
      label TEXT NOT NULL DEFAULT 'Research session',
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS research_sessions_email_idx ON research_sessions(email);
  `);
}
