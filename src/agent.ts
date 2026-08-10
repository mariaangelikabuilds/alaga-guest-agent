// The agent. One guest message in, one handled turn out: it remembers the whole journey,
// reasons, uses tools that do real work, and respects a hard escalation boundary.
//
// The design decision worth naming: the deterministic guardrail runs BEFORE the model
// and, if it fires, both steers the model and backstops it. If the model somehow fails
// to escalate a safety or money issue, the code escalates anyway. Trust does not depend
// on the model choosing correctly on the worst message of the week.

import Anthropic from "@anthropic-ai/sdk";
import type { DatabaseSync } from "node:sqlite";
import { loadContext } from "./context.ts";
import { screen } from "./guardrails.ts";
import { systemPrompt } from "./persona.ts";
import { toolDefs, runTool } from "./tools.ts";

const MODEL = process.env.ALAGA_MODEL || "claude-sonnet-5";

export interface TurnResult {
  reply: string;
  toolsUsed: string[];
  sideEffects: string[];
  escalated: boolean;
  forcedByGuardrail: boolean;
}

export async function handleTurn(
  client: Anthropic,
  db: DatabaseSync,
  bookingId: string,
  guestMessage: string,
  now: string,
): Promise<TurnResult> {
  const ctx = loadContext(db, bookingId, now);
  const gate = screen(guestMessage);

  const system = systemPrompt(ctx.facts, ctx.stage, gate.guidance);

  // The prior thread is the memory the model reasons over, as real turns.
  const messages: Anthropic.MessageParam[] = ctx.history
    .filter((m) => m.role === "guest" || m.role === "agent")
    .map((m) => ({ role: m.role === "guest" ? "user" : "assistant", content: m.body }));
  messages.push({ role: "user", content: guestMessage });

  const toolsUsed: string[] = [];
  const sideEffects: string[] = [];
  let escalated = false;

  // Tool-use loop: let the model act until it has nothing left to do.
  for (let step = 0; step < 6; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: toolDefs,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const reply = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("\n").trim();
      finalize(db, bookingId, guestMessage, reply, now);
      // Deterministic backstop: a guarded message that never got escalated, gets escalated.
      if (gate.forceEscalate && !escalated) {
        backstopEscalate(db, bookingId, gate.reason!, gate.severity!, guestMessage, now);
        escalated = true;
        sideEffects.push(`ESCALATED by guardrail backstop: ${gate.reason}`);
      }
      return { reply, toolsUsed, sideEffects, escalated, forcedByGuardrail: gate.forceEscalate };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      toolsUsed.push(block.name);
      if (block.name === "escalate_to_human") escalated = true;
      const out = await runTool(db, bookingId, now, block.name, block.input as Record<string, unknown>);
      if (out.sideEffect) sideEffects.push(out.sideEffect);
      results.push({ type: "tool_result", tool_use_id: block.id, content: out.text });
    }
    messages.push({ role: "user", content: results });
  }

  throw new Error("tool loop did not converge");
}

function finalize(db: DatabaseSync, bookingId: string, guestMsg: string, reply: string, now: string): void {
  const ins = db.prepare("INSERT INTO messages (booking_id,role,body,created_at) VALUES (?,?,?,?)");
  ins.run(bookingId, "guest", guestMsg, now);
  if (reply) ins.run(bookingId, "agent", reply, now);
}

function backstopEscalate(db: DatabaseSync, bookingId: string, reason: string, severity: string, guestMsg: string, now: string): void {
  db.prepare(
    "INSERT INTO escalations (booking_id,reason,severity,summary,suggested_action,created_at) VALUES (?,?,?,?,?,?)"
  ).run(bookingId, reason, severity, `Guest message flagged by guardrail: "${guestMsg}"`, "Operator to review and respond directly.", now);
}
