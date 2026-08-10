# Stack point of view and 90-day plan

A note on how I would build the best guest-facing agent in hospitality, written from the
proof in this repo. It is opinionated on purpose. You can disagree with any of it in the
first week; that is the job.

## The honest audit: why most guest bots are "roughly in line"

Generic guest bots plateau for three reasons, and none of them is the model.

1. **They treat a stay as a chat session.** Context resets, so the bot re-asks what it
   should already know and cannot reason about where the guest is in the journey. Fixing
   this is a memory and retrieval problem, not a prompt.
2. **They talk instead of act.** They answer "I'll let the host know" and nothing happens.
   The value is in the side effect (a ticket opened, a cleaner rescheduled), and that
   needs a real tool and workflow layer, governed.
3. **They have no floor.** The same model that charms a guest about brunch will
   confidently mishandle a refund or a gas leak. Without a deterministic boundary, one bad
   answer on a safety or money message is a genuine incident, so operators keep a human on
   everything and the bot saves nothing.

The agent in this repo is built around fixing those three, in that order.

## Stack choices

**Models.** Claude, tiered by the job. Sonnet for the guest turn: it is fast, cheap enough
to run on every message, and its tone is already good. Reserve a larger model for offline
work where quality beats latency (drafting operator playbooks, hard escalation summaries,
evals). Route by task, not by habit. The unlimited-token policy means the constraint is
latency and correctness, not spend, so spend where it buys reliability.

**Orchestration.** A tool-use loop with a deterministic guardrail in front, exactly as in
`src/agent.ts`. The agent is not a graph of prompts; it is one reasoning loop with a hard
boundary and real tools. Keep the boundary in code, keep the judgement in the model. Add
graph complexity only when a real use case forces it.

**Memory and context.** The journey store (`src/db.ts`) is the spine: bookings, every
message, events, escalations, in Postgres/Supabase. Context is assembled per turn from
that store, including open tickets, so the agent is stateless in process and durable in
data. As history grows, add retrieval: summarise older turns, keep the booking facts and
open items always-on. Long memory is a data-modelling problem first and a context-window
problem second.

**Guardrails.** The deterministic layer (`src/guardrails.ts`) is the reason an operator
would trust this in production. It force-escalates safety, money, legal, and access
failures before the model runs, and backstops the model if it fails to escalate. This is
the piece I would not compromise. Everything else can be iterated live; the floor ships
first.

**Actions and workflows.** The agent triggers workflows rather than integrating every app
itself. In this proof that is n8n (`Guest Ops`), verified end to end. In production I would
move the durable, retried, scheduled work to Trigger.dev (your stack) and keep the agent
thin: decide, then hand off. Apps (Slack for the operator, Airtable or Notion for the ops
record, Gmail, Calendar) hang off that workflow layer, not off the agent.

**Channels.** WhatsApp and email are adapters over the same agent, not separate agents.
The reasoning does not change per channel; only the transport does.

## The 90-day plan

Mapped to your process, because your process is the plan.

**Days 1 to 30. Get deep, form a view.**
Live in the platform. Ride along with two or three real operators and read their actual
guest threads, the messy ones. Audit the current AI honestly against the three failure
modes above and write down where it actually breaks, with transcripts. Stand up the eval
harness now: a set of real guest messages with the correct action for each (answer, act,
escalate), so every later change is measured, not felt. Deliverable: a written audit and a
stack recommendation you can argue with.

**Days 31 to 60. Architect and build.**
Build the core the way this repo sketches it: the journey store, the context assembler,
the tool layer on Trigger.dev, and the guardrail. Get the guardrail into production first
and prove it with the eval set: zero safety or money messages auto-resolved, ever. Then
the human voice and the routine-handling quality. Instrument everything: every turn logs
its context, decision, tools, and whether a human took over. Deliverable: the core agent
and the guardrails, trustworthy enough to handle a real thread with a human watching.

**Days 61 to 90. Ship it and prove it.**
Put it on real guest communication for a cohort of operators who opted in, human still one
tap away. Measure the numbers that matter: share of messages fully handled, escalation
precision (did it escalate the right ones and only those), median response time, and
operator-reported trust. Iterate on the eval set weekly. Deliverable: a working
guest-facing agent handling real communication end to end, demonstrably past the market's
bots on those numbers, plus the roadmap for scaling it across the guest journey and into
voice.

## What I would not do in 90 days

Not voice yet. Not every edge case. Not a graph framework the use cases have not asked
for. Nail the hardest thing (trustworthy guest communication with a real floor) on real
traffic, and let the numbers earn the next bet.
