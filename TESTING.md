# Testing — Deadline Radar

No time for a real test suite. This is a smoke-test checklist — fast manual/curl checks per phase, run as each phase finishes, not all saved for the end.

## Phase 1 — Extraction
- [ ] Run extraction against seed data (script or console log), confirm N commitments returned where N is plausible (not 0, not one per message)
- [ ] Spot check 2 extracted commitments: owner and dueDate actually match the source text
- [ ] Confirm a clearly non-commitment message (e.g. "lol nice") produces no extraction

## Phase 2 — Risk scoring + dashboard
- [ ] Manually construct one near-due + stale-activity commitment and one far-due + recent-activity commitment — confirm the first scores meaningfully higher
- [ ] Dashboard renders all commitments with correct color banding (not all one color)
- [ ] "Simulate time passing" button visibly changes at least one score live

## Phase 3 — Escalation + HITL
- [ ] Crossing the risk threshold produces an EscalationCard with real drafted text (not a placeholder)
- [ ] Edit → approve sends the edited text, not the original draft
- [ ] Dismiss returns status to `tracked`, not stuck in `flagged`

## Phase 4 — Slack delivery
- [ ] Before wiring into UI: raw `curl -X POST -H "Content-Type: application/json" -d '{"text":"test"}' $SLACK_WEBHOOK_URL` lands in the real channel
- [ ] Approve action in-app sends and channel receives it
- [ ] Unset webhook URL → approve action logs in-app instead of crashing

## Phase 5 — Sidebar
- [ ] Ask "what's my riskiest deadline right now?" — answer references the actual current highest-risk commitment, not a generic response

## Final acceptance test
- [ ] Full 5-step demo script, cold start, real API calls, under 2 minutes, no crash, no visible error in console during the recording
