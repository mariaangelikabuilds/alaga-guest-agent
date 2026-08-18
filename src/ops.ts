// The bridge from "the agent decided something" to "something happened in the real
// world". Every side effect goes through here: it records the event in memory and fires
// the operator's workflow (n8n) which fans out to the connected apps (Slack, Gmail,
// Airtable, Calendar). If no webhook is configured, it degrades to a local record so the
// agent still runs end to end, and the demo still shows the intended side effect.

import type { DatabaseSync } from "node:sqlite";

const WEBHOOK = process.env.N8N_OPS_WEBHOOK?.trim();
// The webhook is gated on this shared secret; without it n8n answers 403 and the
// trigger is recorded locally as undelivered rather than silently dropped.
const WEBHOOK_KEY = process.env.N8N_OPS_KEY?.trim();

export interface TriggerResult { delivered: boolean; ref: string; }

export async function fireWorkflow(
  db: DatabaseSync,
  bookingId: string,
  kind: string,
  payload: Record<string, unknown>,
  now: string,
): Promise<TriggerResult> {
  let delivered = false;
  let ref = `local-${kind}-${Date.now()}`;

  if (WEBHOOK) {
    try {
      const res = await fetch(WEBHOOK, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(WEBHOOK_KEY ? { "x-guest-ops-key": WEBHOOK_KEY } : {}),
        },
        body: JSON.stringify({ kind, bookingId, payload, at: now }),
      });
      delivered = res.ok;
      ref = res.headers.get("x-execution-id") || `n8n-${res.status}`;
    } catch (e) {
      ref = `webhook-failed: ${(e as Error).message}`;
    }
  }

  db.prepare(
    "INSERT INTO events (booking_id,kind,payload,external_ref,created_at) VALUES (?,?,?,?,?)"
  ).run(bookingId, kind, JSON.stringify(payload), ref, now);

  return { delivered, ref };
}
