// The journey-memory store. SQLite via Node's built-in driver (no native deps).
// In production this is Supabase/Postgres; the schema is the same shape.
//
// The point of this file: a guest is not a chat session. A guest is a booking that
// moves through stages over days, and the agent must hold every fact and every prior
// message across that whole arc. That is what these tables persist.

import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(here, "..", "alaga.db");

export function open(path: string = DB_PATH): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      check_out_time TEXT NOT NULL,
      wifi_name TEXT, wifi_password TEXT,
      parking TEXT,
      house_rules TEXT,
      access_notes TEXT,
      owner_name TEXT NOT NULL,
      owner_contact TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      guest_name TEXT NOT NULL,
      guest_channel TEXT NOT NULL,          -- whatsapp | email | app
      party_size INTEGER NOT NULL,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      status TEXT NOT NULL,                 -- upcoming | in_stay | checked_out
      total_amount TEXT,
      language TEXT DEFAULT 'en'
    );

    -- Every message either party has sent. This IS the long memory.
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      role TEXT NOT NULL,                   -- guest | agent | owner
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Real side effects the agent triggered (maintenance, workflows). Not chat.
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      kind TEXT NOT NULL,                   -- maintenance | workflow | note
      payload TEXT NOT NULL,
      external_ref TEXT,                    -- e.g. an n8n execution id
      created_at TEXT NOT NULL
    );

    -- Anything handed to a human, with the drafted summary. The trust boundary.
    CREATE TABLE IF NOT EXISTS escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      reason TEXT NOT NULL,
      severity TEXT NOT NULL,               -- high | urgent
      summary TEXT NOT NULL,
      suggested_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
  `);
}
