# Build Plan — Deadline Radar (4.5hr window)

Living checklist. Update checkboxes and the STATUS line as phases complete — paste just this file back to me when asking "what's next," not the full history.

**Current phase:** CopilotKit wiring is built and typechecks (actions, HITL approval card, sidebar) but is blocked on a real `OPENAI_API_KEY` — nothing that calls the LLM has been exercised live yet. See FAILURES.md for what was checked.

| # | Phase | Time budget | Done when | Status |
|---|---|---|---|---|
| 0 | Investigate existing repo | 15 min | Full audit report received | ✅ |
| 1 | Seed data + extraction pipeline (no UI) | 45 min | Running extraction against seed data returns correct Commitment[] in console/logs | ⬜ |
| 2 | Risk scoring + CopilotKit dashboard | 45 min | Dashboard renders real commitments with correct risk colors, useCopilotReadable exposes state | ✅ |
| 3 | Escalation drafting + HITL approval card | 45 min | Crossing threshold produces EscalationCard; approve/edit/dismiss all work | 🟡 partial — draftEscalation/dismissFlag/approveEscalation are real CopilotKit actions, approveEscalation renders as true generative UI via `renderAndWaitForResponse` (not the old prop-callback component), all three call the existing store logic and typecheck. NOT done: drafting is still the hardcoded template (by design — real GPT-4o drafting is the next task); nothing auto-flags a commitment when its score crosses threshold (manual trigger only, same pre-existing limitation as before); the whole chat-triggered path is unverified live — no real `OPENAI_API_KEY` exists to confirm the LLM actually calls these tools end-to-end. |
| 4 | Slack webhook delivery | 30 min | Approved escalation lands in real Slack channel (or logs cleanly if webhook unset) | ✅ (unchanged this task — `lib/slack.ts` was already correct; now also reachable through the new HITL approve flow, not just the REST route) |
| 5 | Sidebar conversational queries | 30 min | Sidebar answers grounded questions about current state | 🟡 blocked — `CopilotSidebar` is mounted, `useCopilotReadable` exposes full live state and instructions are set, but zero grounded answers have actually been produced because there's no real `OPENAI_API_KEY` to test against. |
| 6 | Exa enrichment (stretch — cut first) | 20 min | Escalation draft includes fetched external context when relevant | ⬜ |
| 7 | Risk Radar visual polish | 20 min | Looks demo-ready, not just functional | ⬜ (explicitly out of scope for this task) |
| — | Buffer: demo rehearsal + record video | 20 min | Full 5-step demo script runs clean, under 2 min | ⬜ |

## Definition of done for the whole project
The 5-step demo script (dashboard calm → simulate time → risk spikes → draft appears → approve → Slack receives it → sidebar answers a grounded question) runs start to finish without a crash, using real API calls (not mocked responses), in under 2 minutes.

## Escalation rule for this plan
If any phase overruns its budget by more than 50%, stop, cut the next stretch item (see ARCHITECTURE.md cut order), and move on. Don't let one phase eat the buffer.
