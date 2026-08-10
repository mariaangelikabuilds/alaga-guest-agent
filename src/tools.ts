// The agent's hands. Three tools, each a real side effect that writes to memory and
// fires the operator's workflow. Kept deliberately small: an agent with five clean
// tools it uses correctly beats one with twenty it fumbles.

import type Anthropic from "@anthropic-ai/sdk";
import type { DatabaseSync } from "node:sqlite";
import { fireWorkflow } from "./ops.ts";

export const toolDefs: Anthropic.Tool[] = [
  {
    name: "log_maintenance_issue",
    description:
      "Record a maintenance problem the guest reported (aircon, plumbing, appliance, etc.) and dispatch it to the operator's workflow. Use for physical issues with the unit that a person needs to fix. Do NOT use for safety emergencies (those are escalations).",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One line: what is wrong and where in the unit." },
        urgency: { type: "string", enum: ["routine", "same_day", "urgent"], description: "How fast a fix is needed." },
      },
      required: ["summary", "urgency"],
    },
  },
  {
    name: "get_local_recommendations",
    description:
      "Get vetted nearby recommendations to share with the guest (food, coffee, transport, attractions) close to the property.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["food", "coffee", "transport", "attractions"] },
      },
      required: ["category"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand this conversation to the operator with a written summary. Use for anything you are not allowed to resolve alone: money/refunds, safety, legal, security, or when you are genuinely unsure. This never resolves the issue itself; it puts a person on it.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        severity: { type: "string", enum: ["high", "urgent"] },
        summary: { type: "string", description: "What happened and what the guest wants, in the operator's words." },
        suggested_action: { type: "string", description: "The concrete next step you recommend the operator take." },
      },
      required: ["reason", "severity", "summary", "suggested_action"],
    },
  },
];

// Curated so the demo runs without a live places API; in production this is a maps/POI call.
const RECS: Record<string, string[]> = {
  food: ["Wildflour Cafe + Bakery (5 min, all-day dining)", "Manam Comfort Filipino (8 min, local favourites)", "Nikkei (10 min, Japanese-Peruvian)"],
  coffee: ["Tim Hortons ground floor (2 min)", "% Arabica BGC (12 min)", "Commune (15 min, specialty)"],
  transport: ["Grab is the reliable option here; set pickup to the Azure lobby, Bldg A.", "Airport is ~25 min off-peak, plan 60 min in rush hour."],
  attractions: ["Bonifacio High Street (12 min, shops + dining)", "Mind Museum (15 min)", "Ayala Museum (20 min)"],
};

export interface ToolOutcome { text: string; sideEffect?: string; }

export async function runTool(
  db: DatabaseSync,
  bookingId: string,
  now: string,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolOutcome> {
  if (name === "get_local_recommendations") {
    const cat = String(input.category);
    return { text: (RECS[cat] || ["No list for that category."]).join("\n") };
  }

  if (name === "log_maintenance_issue") {
    const r = await fireWorkflow(db, bookingId, "maintenance", input, now);
    return {
      text: `Logged and dispatched to the operator's maintenance workflow (ref ${r.ref}).`,
      sideEffect: `maintenance dispatched: ${input.summary} [${input.urgency}]`,
    };
  }

  if (name === "escalate_to_human") {
    db.prepare(
      "INSERT INTO escalations (booking_id,reason,severity,summary,suggested_action,created_at) VALUES (?,?,?,?,?,?)"
    ).run(bookingId, input.reason, input.severity, input.summary, input.suggested_action, now);
    const r = await fireWorkflow(db, bookingId, "escalation", input, now);
    return {
      text: `Escalated to the operator (ref ${r.ref}). A person now owns this.`,
      sideEffect: `ESCALATED [${input.severity}]: ${input.reason}`,
    };
  }

  return { text: `Unknown tool ${name}.` };
}
