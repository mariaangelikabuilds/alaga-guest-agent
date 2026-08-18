// The trust boundary. Some guest messages must NEVER be auto-answered, no matter how
// confident the model is: safety, money movement, legal threats, security. This runs
// deterministically BEFORE the model, so the escalation does not depend on the model
// deciding to escalate. The model proposes; this decides what it is never allowed to
// handle alone. Same pattern as a production guardrail layer.

export type Severity = "high" | "urgent";
export interface GateVerdict {
  forceEscalate: boolean;
  severity?: Severity;
  reason?: string;
  guidance?: string;   // one line the agent must tell the guest right now
}

interface Rule {
  test: RegExp;
  severity: Severity;
  reason: string;
  guidance: string;
}

// Ordered: urgent safety first. A hit forces escalation and hands the agent a safe
// NOTE: match the words guests actually type, not the dictionary form. blood
// did not match "he's bleeding", so a bleeding child did not force escalation.
// Found by src/guardrails.test.ts on its first run, which is what it is for.
// holding line, so the guest is never left waiting on a human-only issue.
const RULES: Rule[] = [
  {
    test: /\b(gas|smoke|fire|burning|carbon monoxide|electric shock|sparking|flood|break ?in|intruder|blood|bleeding|bleed|injur(?:y|ed|ies)|can'?t breathe|unconscious|assault)\b/i,
    severity: "urgent",
    reason: "possible safety incident",
    guidance: "Treat as a safety issue: give the one immediate safety step, tell the guest a person is being reached right now, and share the operator's direct number.",
  },
  {
    test: /\b(charged twice|double ?charged|overcharged|refund|chargeback|dispute (the|my) charge|money back|fraud|unauthori[sz]ed charge)\b/i,
    severity: "high",
    reason: "billing or refund dispute",
    guidance: "Do NOT promise, approve, or deny any refund or amount. Acknowledge, say the operator will review the charge, and hand off.",
  },
  {
    test: /\b(lawyer|sue|lawsuit|legal action|police|report you|small claims|defamation)\b/i,
    severity: "high",
    reason: "legal threat",
    guidance: "Stay calm and factual, make no admissions or commitments, and escalate to the operator.",
  },
  {
    test: /\b(locked out|can'?t get in|lock ?box broken|smart lock (dead|not working)|no access|stranded)\b/i,
    severity: "urgent",
    reason: "guest access failure",
    guidance: "Give the fastest known access path, then reach the operator immediately; a guest with no entry is time-critical.",
  },
];

export function screen(message: string): GateVerdict {
  for (const r of RULES) {
    if (r.test.test(message)) {
      return { forceEscalate: true, severity: r.severity, reason: r.reason, guidance: r.guidance };
    }
  }
  return { forceEscalate: false };
}
