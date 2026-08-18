// The trust boundary is the one thing in this project that must not depend on the
// model behaving, so it is the one thing that most needs a test. Run: npm test
//
// These assert on screen() directly. The agent's deterministic backstop in agent.ts
// consumes this verdict and escalates when the model did not, so if screen() stops
// firing, the backstop never runs and the guarantee is gone silently.
import assert from "node:assert/strict";
import { screen } from "./guardrails.js";

// Real phrasings, not keyword bait. A guest writes "I think I smell gas", not "gas".
const MUST_ESCALATE: Array<[string, string]> = [
  ["I think I smell gas in the kitchen, is that normal?", "possible safety incident"],
  ["there's smoke coming from the aircon unit", "possible safety incident"],
  ["my son fell and he's bleeding, what do I do", "possible safety incident"],
  ["I've been charged twice for the same night", "billing or refund dispute"],
  ["can I get a refund for the extra day", "billing or refund dispute"],
  ["this is an unauthorised charge on my card", "billing or refund dispute"],
  ["I'm going to speak to my lawyer about this", "legal threat"],
  ["if this isn't fixed I will report you to the police", "legal threat"],
  ["we are locked out, the lockbox is broken", "guest access failure"],
  ["the smart lock is dead and we're stranded outside", "guest access failure"],
];

// Ordinary hospitality traffic. If any of these escalate, the agent is useless: it
// hands every message to a human and there is no point automating it.
const MUST_NOT_ESCALATE = [
  "what time is check out?",
  "is there parking nearby?",
  "could we get extra towels please",
  "the wifi password isn't working, can you resend it",
  "what's the best place for breakfast around here",
  "can we check in an hour early",
  "how do I use the washing machine",
];

function everyGuardedMessageEscalates() {
  for (const [message, reason] of MUST_ESCALATE) {
    const verdict = screen(message);
    assert.equal(verdict.forceEscalate, true, `should escalate: ${message}`);
    assert.equal(verdict.reason, reason, `wrong reason for: ${message}`);
    // A verdict without these is useless downstream: the agent has nothing to tell
    // the guest and the escalation record has nothing to file under.
    assert.ok(verdict.severity, `no severity for: ${message}`);
    assert.ok(verdict.guidance, `no guidance for: ${message}`);
  }
}

function ordinaryMessagesPassThrough() {
  for (const message of MUST_NOT_ESCALATE) {
    const verdict = screen(message);
    assert.equal(verdict.forceEscalate, false, `should not escalate: ${message}`);
    assert.equal(verdict.severity, undefined);
    assert.equal(verdict.guidance, undefined);
  }
}

function safetyOutranksTheRest() {
  // A message carrying both a safety word and a money word must come back as the
  // safety one. Rule order is load-bearing and nothing else asserts it.
  const verdict = screen("there is smoke in the room and I want a refund for tonight");
  assert.equal(verdict.severity, "urgent", "safety must win over billing");
  assert.equal(verdict.reason, "possible safety incident");
}

function severityMatchesUrgency() {
  // Time-critical things are urgent; things needing a decision are high. Getting this
  // backwards would page someone at 3am about a refund and sit on a lockout.
  assert.equal(screen("we are locked out").severity, "urgent");
  assert.equal(screen("I can't breathe properly in here").severity, "urgent");
  assert.equal(screen("I want a chargeback").severity, "high");
  assert.equal(screen("I'll take this to small claims").severity, "high");
}

const checks = [
  everyGuardedMessageEscalates,
  ordinaryMessagesPassThrough,
  safetyOutranksTheRest,
  severityMatchesUrgency,
];

for (const check of checks) check();
console.log(
  `guardrails: ${MUST_ESCALATE.length} guarded messages escalate with severity and guidance, ` +
    `${MUST_NOT_ESCALATE.length} ordinary messages pass through, safety outranks billing, severities correct`,
);
