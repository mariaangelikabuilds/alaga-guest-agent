// Talk to Alagà as the guest. Memory persists between turns and between runs (it is in
// the DB), so you can close this and come back and it still knows the whole stay.
//   npm run seed   (once)
//   npm run chat

import "./env.ts";
import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { open } from "./db.ts";
import { handleTurn } from "./agent.ts";
import { BOOKING_ID } from "./seed.ts";

const NOW = process.env.ALAGA_NOW || new Date().toISOString();

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const db = open();
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("\nYou are the guest (Marcus). Type a message, or 'exit'.\n");

  while (true) {
    const message = (await rl.question("guest > ")).trim();
    if (!message || message === "exit") break;
    const t = await handleTurn(client, db, BOOKING_ID, message, NOW);
    console.log("\nAlagà > " + t.reply + "\n");
    if (t.sideEffects.length) console.log("  [" + t.sideEffects.join(" | ") + "]\n");
  }
  rl.close();
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
