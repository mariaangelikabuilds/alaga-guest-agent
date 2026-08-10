// Replays a full guest journey and prints the transcript with the side effects the agent
// triggered. This is the demo: watch it remember, act, and escalate correctly.
//   npm run seed && npm run demo

import "../src/env.ts";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { open } from "../src/db.ts";
import { handleTurn } from "../src/agent.ts";
import { BOOKING_ID } from "../src/seed.ts";

const here = dirname(fileURLToPath(import.meta.url));
const scenario = JSON.parse(readFileSync(join(here, "scenario.json"), "utf8"));

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const db = open();

  console.log(bold("\n  Alagà · guest journey replay"));
  console.log(dim(`  Marcus Lim · Azure Residences 1806, Metro Manila · day 3 of 4\n`));

  for (const message of scenario.messages as string[]) {
    console.log(bold("  Guest:  ") + message);
    const t = await handleTurn(client, db, BOOKING_ID, message, scenario.now);
    console.log(bold("  Alagà:  ") + t.reply.replace(/\n/g, "\n          "));
    if (t.toolsUsed.length) console.log(dim(`          tools: ${t.toolsUsed.join(", ")}`));
    for (const s of t.sideEffects) {
      const line = s.startsWith("ESCALATED") ? red("          ⚑ " + s) : green("          ✓ " + s);
      console.log(line);
    }
    if (t.forcedByGuardrail) console.log(dim("          (deterministic guardrail: escalation guaranteed on this class of message)"));
    console.log();
  }

  const esc = db.prepare("SELECT reason, severity FROM escalations WHERE booking_id = ?").all(BOOKING_ID);
  const evt = db.prepare("SELECT kind FROM events WHERE booking_id = ?").all(BOOKING_ID);
  console.log(dim(`  ${evt.length} workflow event(s), ${esc.length} escalation(s) recorded in memory.\n`));
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
