// Assembles the guest-journey context the agent reasons over. This is the difference
// between a chatbot and a guest agent: not the last message, but the whole arc.

import type { DatabaseSync } from "node:sqlite";

export interface JourneyContext {
  stage: "pre_arrival" | "arrival_day" | "in_stay" | "checkout_day" | "post_stay";
  nightsLeft: number;
  property: Record<string, unknown>;
  booking: Record<string, unknown>;
  history: { role: string; body: string; created_at: string }[];
  facts: string;   // the flattened brief the model reads
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function stageOf(now: string, checkIn: string, checkOut: string): JourneyContext["stage"] {
  const toIn = daysBetween(now.slice(0, 10), checkIn);
  const toOut = daysBetween(now.slice(0, 10), checkOut);
  if (toIn > 0) return "pre_arrival";
  if (toIn === 0) return "arrival_day";
  if (toOut > 0) return "in_stay";
  if (toOut === 0) return "checkout_day";
  return "post_stay";
}

export function loadContext(db: DatabaseSync, bookingId: string, now: string): JourneyContext {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;
  if (!booking) throw new Error(`no booking ${bookingId}`);
  const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(booking.property_id) as Record<string, unknown>;
  const history = db.prepare(
    "SELECT role, body, created_at FROM messages WHERE booking_id = ? ORDER BY id"
  ).all(bookingId) as JourneyContext["history"];

  const stage = stageOf(now, String(booking.check_in), String(booking.check_out));
  const nightsLeft = Math.max(0, daysBetween(now.slice(0, 10), String(booking.check_out)));

  // Open items are memory too: the agent must not re-log a ticket it already opened.
  const openEvents = db.prepare("SELECT kind, payload FROM events WHERE booking_id = ?").all(bookingId) as { kind: string; payload: string }[];
  const openEsc = db.prepare("SELECT reason, severity FROM escalations WHERE booking_id = ? AND status = 'open'").all(bookingId) as { reason: string; severity: string }[];
  const openItems = [
    ...openEvents.map((e) => `- ${e.kind}: ${(JSON.parse(e.payload).summary ?? JSON.parse(e.payload).reason ?? "logged")} (already dispatched, do not re-log)`),
    ...openEsc.map((e) => `- escalation open with operator: ${e.reason} [${e.severity}] (a person owns it, do not re-escalate)`),
  ];

  const facts = [
    `PROPERTY: ${property.name}, ${property.address}, ${property.city}.`,
    `Check-in ${property.check_in_time}, check-out ${property.check_out_time}.`,
    `WiFi: ${property.wifi_name} / ${property.wifi_password}. Parking: ${property.parking}`,
    `Access: ${property.access_notes}`,
    `House rules: ${property.house_rules}`,
    `Operator: ${property.owner_name} (${property.owner_contact}).`,
    ``,
    `GUEST: ${booking.guest_name}, party of ${booking.party_size}, via ${booking.guest_channel}.`,
    `Stay: ${booking.check_in} to ${booking.check_out}. Booking total ${booking.total_amount}.`,
    `Journey stage RIGHT NOW: ${stage} (${nightsLeft} night(s) left). Today is ${now.slice(0, 10)}.`,
    openItems.length ? `\nOPEN ITEMS (already handled, do not repeat):\n${openItems.join("\n")}` : "",
  ].join("\n");

  return { stage, nightsLeft, property, booking, history, facts };
}
