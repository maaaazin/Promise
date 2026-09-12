# Architecture & Decisions — Deadline Radar

Reference doc for Claude Code. Read once, don't re-derive these decisions mid-build — they're locked for this hackathon window.

## Core loop
Seed data (Slack + email JSON) → extraction (GPT-4o, structured output) → commitment store → risk scoring → CopilotKit dashboard (generative UI) → threshold breach → escalation draft (GPT-4o, +Exa enrichment) → HITL approval card → Slack webhook send → status update.

## Non-negotiables (do not change without asking)
- No live OAuth to Slack or email. Ingestion is mock seed JSON only — this is a deliberate reliability choice for the demo, not a shortcut to fix.
- CopilotKit dashboard is the primary interaction surface. Slack/email are ingestion sources; Slack webhook is one delivery channel. Don't build a second UI surface.
- Every outbound send (Slack message) requires explicit human approval via a CopilotKit HITL action. No auto-send, ever, even in a "demo mode."
- Data layer: in-memory or lowdb only. No new database, no ORM setup — speed over durability, this is a demo.

## Explicitly rejected (don't revisit these)
- Full Slack App + OAuth install — too fragile for a live demo window
- Real email ingestion (IMAP/Gmail API) — same reason
- Postgres/any hosted DB — unnecessary setup cost for a few hours of runtime
- Multi-model routing (OpenRouter) — out of scope for this build; single OpenAI key only

## Frozen contracts
- Commitment type and status state machine: see DATA_SPEC.md — don't redefine fields ad hoc in one file without updating that doc.
- CopilotKit actions: `extractCommitments`, `recomputeRisk`, `draftEscalation`, `approveEscalation` (HITL-gated), `dismissFlag`. Keep these five names and rough signatures stable — the dashboard, demo script, and judging notes all assume them.

## If time runs out — cut in this order
1. Exa enrichment (stretch feature, cut first)
2. Sidebar conversational queries
3. Risk Radar visual polish (keep it functional/ugly over missing)

Never cut: extraction, risk scoring, escalation drafting, HITL approval, Slack delivery — these five are the actual judged workflow.

## Why this order
The escalation-drafting + HITL-approval step is the centerpiece — it's the one thing a plain chatbot structurally cannot do (act across systems with a human checkpoint). Protect that over anything else if the clock runs short.
