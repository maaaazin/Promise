# Data Spec — Deadline Radar

Reference doc for Claude Code. This is the canonical shape for all data in the system — don't invent alternate field names in individual files.

⚠️ Seed data shape below is PROPOSED, not confirmed — check the investigation results against the teammate's actual seed-slack.json / seed-email.json first. If they already exist in a different shape, update this file to match reality rather than rewriting their data.

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
