// Seeds one property, one operator, one guest mid-stay, and the early history the agent
// should already "remember". A Manila short-term rental: exactly the underserved SEA
// operator this is built for. Run once: `npm run seed`.

import { open, migrate, DB_PATH } from "./db.ts";
import { existsSync, rmSync } from "node:fs";

export const BOOKING_ID = "bk_1042";
const PROPERTY_ID = "prop_azure_1806";

export function seed(): void {
  if (existsSync(DB_PATH)) rmSync(DB_PATH);
  const db = open();
  migrate(db);

  db.prepare(
    `INSERT INTO properties (id,name,address,city,check_in_time,check_out_time,wifi_name,wifi_password,parking,house_rules,access_notes,owner_name,owner_contact)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    PROPERTY_ID,
    "Azure Residences 1806 · 2BR",
    "Azure Urban Resort Residences, Bldg A, Unit 1806, Paranaque",
    "Metro Manila",
    "3:00 PM", "11:00 AM",
    "Azure1806_5G", "seabreeze1806",
    "One free slot, basement P2, slot 44. Height limit 2.0m.",
    "No parties. No smoking indoors. Quiet hours 10 PM to 7 AM.",
    "Smart lock. Code sent 2 hours before check-in. Lobby will ask for the booking name.",
    "Rhea (operator, 14 listings)", "+63 917 555 0110"
  );

  // Guest is mid-stay right now: checked in yesterday, leaves in a couple of days.
  db.prepare(
    `INSERT INTO bookings (id,property_id,guest_name,guest_channel,party_size,check_in,check_out,status,total_amount,language)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    BOOKING_ID, PROPERTY_ID, "Marcus Lim", "whatsapp", 2,
    "2026-07-31", "2026-08-04", "in_stay", "PHP 18,400", "en"
  );

  // History the agent already lived through. It must not re-ask any of this.
  const msg = db.prepare(
    "INSERT INTO messages (booking_id,role,body,created_at) VALUES (?,?,?,?)"
  );
  const history: [string, string, string][] = [
    ["guest", "Hi! Just booked for the 31st, travelling with my wife. First time in Manila.", "2026-07-28T09:12:00+08:00"],
    ["agent", "Welcome, Marcus. You and your wife are all set for the 31st to the 4th at Azure 1806. I'll send your smart-lock code two hours before check-in. Anything you'd like ready for arrival?", "2026-07-28T09:18:00+08:00"],
    ["guest", "We land around 1pm on the 31st. Might be early.", "2026-07-28T09:20:00+08:00"],
    ["agent", "Noted. Standard check-in is 3 PM, but I'll ask the unit to be ready earlier and let you know. Safe flight!", "2026-07-28T09:22:00+08:00"],
    ["guest", "Got in fine, code worked. Place is great, thanks!", "2026-07-31T15:40:00+08:00"],
  ];
  for (const [role, body, at] of history) msg.run(BOOKING_ID, role, body, at);

  db.close();
  console.log(`Seeded ${DB_PATH}`);
  console.log(`Property: Azure Residences 1806 (Metro Manila) · Booking ${BOOKING_ID} · Marcus Lim, mid-stay.`);
}

seed();
