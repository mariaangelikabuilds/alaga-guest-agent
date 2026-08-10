# Alagà

A guest-facing AI agent for short-term rental operators. It holds the whole guest
journey in memory, does real work through tools, and knows the handful of things it must
never handle alone. Built on the Claude SDK.

*Alagà* is Filipino for looking after someone. That is the job: make a guest on a
50-listing operator's books feel personally hosted, without a person on every message.

## Why this and not a chatbot

A chatbot answers the last message. A guest agent has to reason over a stay that runs for
days: the booking, the property, every earlier message, the open maintenance ticket, and
where the guest is in the arc (pre-arrival, mid-stay, checkout). It has to take action,
not just talk about it, and it has to know when to put a human on it. That combination is
the hard part, and it is the whole point of this build.

Run the demo and watch one guest, Marcus, move through a real stay:

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run seed
npm run demo
```

## What the demo shows

Marcus is on day 3 of a 4-night stay in a Manila condo. Five messages, one transcript:

1. **"What's the wifi, and what time is checkout?"** It answers from memory. It does not
   ask who he is or look anything up out loud; it already knows.
2. **"The aircon stopped cooling."** It opens a maintenance ticket through a real
   workflow, tells him it is handled, and offers the second bedroom for tonight.
3. **"Dinner spots my wife would like, not too heavy?"** It pulls vetted nearby options
   and does not re-open the aircon ticket, because it remembers that ticket is already open.
4. **"I was charged twice, refund me today or I dispute it."** It refuses to promise or
   deny money. It hands the operator a written summary and tells Marcus a person is on it.
5. **"There's a gas smell near the stove."** It gives one safety instruction and escalates
   immediately.

Messages 4 and 5 escalate whether or not the model decides to, because of the guardrail
below.

## Architecture

Six small pieces, each with one job:

| File | Job |
|------|-----|
| `src/db.ts` | The journey store. A guest is a booking that moves through stages, not a chat session. Bookings, messages, events, escalations. SQLite here, Supabase/Postgres in production, same shape. |
| `src/context.ts` | Assembles what the agent knows this turn: property facts, booking, stay stage, full message history, and open items. This is the long memory. |
| `src/guardrails.ts` | The trust boundary. Deterministic rules that force escalation on safety, money, legal, and access failures, before the model runs. |
| `src/tools.ts` | The agent's hands: log a maintenance issue, pull recommendations, escalate. Each one does real work and records it. |
| `src/persona.ts` | The concierge. Terse, warm, human. The system prompt, injected with facts and stage per turn. |
| `src/agent.ts` | The loop. Guardrail, then context, then a tool-use loop, then persist. |

### The one decision worth defending

The guardrail runs **before** the model and **backstops** it. If a message is about a gas
leak or a double charge, escalation is guaranteed: the code steers the model to escalate,
and if the model somehow fails to, the code escalates anyway. Production trust cannot
depend on the model making the right call on the worst message of the week. The model is
where the judgement and the human voice live; the guardrail is where the floor is.

### Memory, concretely

Each turn rebuilds context from the store, so the agent survives a restart with the whole
stay intact. Open tickets and escalations are part of that context, which is why it will
not double-log the same aircon or re-escalate an issue a human already owns. Close the
CLI, reopen it tomorrow, and it still knows Marcus.

## Real workflows, real apps

When the agent logs maintenance or escalates, it fires a live n8n workflow (`Guest Ops`)
that writes to an operations log and fans out to the operator's connected apps. In this
build the trigger is verified end to end: three agent decisions produced three real
workflow runs. The app fan-out (Slack for the operator, Airtable or Notion for the ops
record, Gmail for guest email, Calendar for scheduling a fix) attaches to that one
workflow, using accounts the operator already has. Trigger.dev is the production-grade
equivalent of that trigger layer.

Set `N8N_OPS_WEBHOOK` to enable it. Leave it empty and the agent still runs end to end,
recording the same side effects locally, so the demo never depends on the network.

## Talk to it yourself

```bash
npm run chat
```

You are the guest. Memory persists between messages and between runs.

## Honest limits

This is a proof on the hardest use case, not a product. Recommendations are a curated
list, not a live places API. There is one property and one guest. The agent replies as
text; wiring it to an actual WhatsApp or email channel is a channel adapter, not new
reasoning. What it is meant to prove is the reasoning, the memory, and the trust boundary,
and those are real and running.

See `docs/STACK-POV.md` for the model, orchestration, memory, and guardrail choices, and
the 90-day plan to take this from proof to production.
