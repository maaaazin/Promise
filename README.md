# Deadline Radar

Deadline Radar is a Next.js prototype for turning informal work commitments into visible, reviewable deadline risks. It models the moment when someone says “I’ll get this to you by Friday” in Slack or email, scores the chance that the commitment may slip, and gives a human an editable escalation message to approve before delivery.

This repository currently provides a reliable, local demo of that workflow. It is **not yet a connected Slack/email agent**: commitments are seeded in memory and the OpenAI, CopilotKit, and Exa integrations described in the original project brief have not been implemented.

## What works today

- A dark-mode dashboard showing four seeded commitments.
- Deterministic risk scoring based on deadline proximity, inactivity, and risk-related language.
- A mock clock: “Simulate 3 days passing” recalculates every risk score.
- A manually triggered escalation draft for each commitment.
- Human-in-the-loop review: the draft is editable and can be approved or dismissed.
- Slack Incoming Webhook delivery when `SLACK_WEBHOOK_URL` is configured.
- A safe demo fallback that records the approved message in memory when no webhook is configured.
- Production build and TypeScript validation through `npm run build`.

## Current architecture

```text
Dashboard (React client)
  ├─ GET /api/radar ────────────────┐
  └─ POST /api/radar ───────────────┤
                                      ▼
                           In-memory commitment store
                                      │
                         Risk scoring + draft template
                                      │
                         Slack webhook or demo log
```

The central files are:

- `app/page.tsx` — dashboard and client-side API calls.
- `app/api/radar/route.ts` — radar actions and Slack delivery orchestration.
- `lib/store.ts` — seeded state, mock clock, and in-memory delivery log.
- `lib/scoring.ts` — deterministic 0–100 risk model.
- `lib/drafts.ts` — current template-based escalation wording.
- `lib/slack.ts` — webhook sender with demo-mode fallback.
- `components/` — Risk Radar, commitment list, and editable escalation card.

## Run locally

### Requirements

- Node.js 18.17 or newer
- npm

### Install and start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `.env.local` only if you want real Slack delivery:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

When the variable is not set, approval remains safe: the app records the delivery in its in-memory demo log rather than sending a message.

The original concept also anticipates `OPENAI_API_KEY` and `EXA_API_KEY`, but neither is used by the current code.

### Validate a production build

```bash
npm run build
```

## API actions

`/api/radar` accepts these actions via `POST`:

| Action | Purpose |
| --- | --- |
| `advance` | Move the mock clock forward; defaults to three days. |
| `recompute` | Recalculate all commitment risk scores. |
| `draft` | Mark a specified commitment as flagged and create a template escalation. |
| `dismiss` | Return a flagged commitment to `tracked`. |
| `approve` | Send the edited or generated draft, then mark the commitment as `escalated`. |

The API is designed for the local demo. It does not currently validate request payloads, authenticate callers, persist data, or enforce a full state-transition policy.

## Risk scoring

Each commitment receives a score between 0 and 100:

- **Deadline proximity:** 5–52 points.
- **Inactivity:** up to 30 points, at 5 points per quiet day.
- **Risk wording:** 13 points if the source contains terms such as “blocked,” “delay,” or “urgent.”

Scores are labeled **On track** (<25), **Watch** (25–44), **At risk** (45–69), or **Critical** (70+).

## Deliberate demo constraints

- State is held in process memory and resets when the server restarts or scales.
- The initial commitments are hard-coded in `lib/store.ts`; there are no Slack/email fixture files yet.
- “Simulate time passing” changes the score only. It does **not** automatically create an escalation card when a threshold is crossed.
- Drafts are currently deterministic templates, not LLM-generated.
- The UI is custom React; CopilotKit packages are installed but not wired into the app.

## Implementation roadmap

1. Add deterministic Slack and email fixtures plus an ingestion contract.
2. Define a persistent commitment lifecycle and automatically flag threshold crossings, while preventing duplicate escalations.
3. Add OpenAI structured extraction and context-aware drafting with deterministic fallbacks for stage demos.
4. Implement the CopilotKit runtime, grounded dashboard state, sidebar questions, and approval actions.
5. Add schema validation, tests, delivery status visibility, and secret/configuration checks.
6. Add an optional Exa verification/enrichment pass before escalation.

The priorities intentionally favor a dependable end-to-end demo before expanding integrations.

## Repository hygiene

`.gitignore` excludes dependencies, Next.js output, environment files, logs, coverage, Vercel metadata, and TypeScript build metadata. If `.next/` files have previously been committed, they must be removed from Git’s index separately before the new ignore rule takes effect for them.

## License

No license has been selected yet.
