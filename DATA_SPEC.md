# Data Spec — Deadline Radar

Reference doc for Claude Code. This is the canonical shape for all data in the system — don't invent alternate field names in individual files.

✅ Seed data shape below is CONFIRMED — `/data/seed-slack.json` and `/data/seed-email.json` each hold a top-level JSON array of the per-message shape shown below (the shape itself is unchanged from the original proposal).

## Commitment (canonical)
```ts
type Commitment = {
  id: string;
  sourceType: "slack" | "email";
  sourceExcerpt: string;
  owner: string;
  description: string;
  dueDate: string;         // ISO date
  lastActivityAt: string;  // ISO date
  riskScore: number;       // 0-100
  status: "tracked" | "flagged" | "escalated" | "resolved";
  escalationDraft?: string;
};
```

## Status state machine
```
tracked --[riskScore crosses threshold]--> flagged
flagged --[human approves]--> escalated
flagged --[human dismisses]--> tracked
escalated --[optional, if time allows]--> resolved
```

## Seed message shape (proposed — verify against repo)
```json
// seed-slack.json
{ "channel": "#eng-launch", "author": "sam", "timestamp": "2026-09-10T14:32:00Z", "text": "don't worry, I'll have the API done by Friday" }

// seed-email.json
{ "threadId": "t1", "from": "sam@co.com", "to": "priya@co.com", "subject": "Re: launch timeline", "timestamp": "2026-09-10T09:00:00Z", "body": "we can push this a week if needed" }
```

## Extraction output (GPT-4o structured output, per message)
```ts
{ owner: string; description: string; dueDate: string; confidence: number; sourceExcerpt: string }
```
Non-commitment messages return nothing — discard, don't force a low-confidence extraction.

Implemented in `lib/extraction.ts` as a single batched call over all seed messages (not one call per
message) using `openai`'s `beta.chat.completions.parse` with a Zod-defined JSON schema — each message
carries its own `id` and `timestamp` in the prompt so the model resolves relative date phrasing ("by
Friday", "end of next week") against that message's own timestamp, not the current real date, and so
results can be traced back to their source message via `sourceMessageId`.

**Confidence floor: 0.6** — anything scored below this is discarded before it ever reaches the store,
per the "don't force a low-confidence extraction" rule above. A commitment with a real promise but no
confidently resolvable date is still returned by the model, but instructed to score ≤ 0.4, so it's
filtered out by this floor rather than landing with a guessed date.

## Risk scoring — proposed formula
Avoids an extra LLM call per commitment by using a light keyword heuristic instead of a second model pass for urgency.

```
daysRemaining = (dueDate - mockCurrentDate) in days
urgencyFromDeadline = 100 * clamp(0, 1, 1 - daysRemaining / 14)

daysSinceActivity = (mockCurrentDate - lastActivityAt) in days
inactivityPenalty = 100 * clamp(0, 1, daysSinceActivity / 7)

sentimentUrgency = 100 if sourceExcerpt contains urgency keywords
                    ("asap", "critical", "urgent", "blocked", "need this now")
                    else 30

riskScore = round(0.5 * urgencyFromDeadline + 0.3 * inactivityPenalty + 0.2 * sentimentUrgency)
```
**Flag threshold: riskScore >= 70** → triggers `draftEscalation`.

Tune the weights/threshold once real seed data is loaded — the important property for the demo is that "simulate time passing" reliably pushes at least one commitment over 70.

## Env vars
| Var | Required | Fallback if unset |
|---|---|---|
| `OPENAI_API_KEY` | Yes | none — extraction/drafting hard-fail without it |
| `EXA_API_KEY` | No (stretch feature) | enrichment step skipped silently |
| `SLACK_WEBHOOK_URL` | No | logs "sent" message in-app instead of posting to Slack |
