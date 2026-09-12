# Failure Log — Deadline Radar

Append every real failure here as it happens: timestamp, what was tried, exact error, root cause, fix. This exists so Claude Code doesn't re-attempt something that already failed, and so patterns are visible if the same thing breaks twice.

## Format
```
### [HH:MM] Short title
Attempted:
Error (paste exact text, don't paraphrase):
Root cause:
Fix:
Time lost:
```

---

## Known gotchas to watch for (not yet happened — preventive)
- CopilotKit runtime endpoint path must match exactly between the frontend provider config and `/app/api/copilotkit/route.ts` — a silent mismatch just looks like "the sidebar doesn't respond," no clear error.
- OpenAI structured outputs (`response_format: json_schema`) fail silently or throw opaque errors if the schema has extra/missing `required` fields — validate the schema against the SDK version actually installed before assuming the extraction prompt is wrong.
- `lowdb` v3+ is ESM-only and can conflict with a CommonJS-configured Next.js setup — if using it, confirm import style works before building on top of it.
- Slack incoming webhooks require `Content-Type: application/json` and reject overly large payloads — test with a raw `curl` call before wiring it into the approval flow, so a UI bug and a webhook bug don't get debugged as one problem.
- Next.js: any env var prefixed `NEXT_PUBLIC_` is exposed to the browser. Never prefix `OPENAI_API_KEY` or `SLACK_WEBHOOK_URL` that way — check this explicitly, it's an easy silent security mistake, not just a bug.
- `useCopilotAction` HITL render props have changed across CopilotKit versions — check the installed version's docs/types before writing the approval card, don't assume an API shape from memory.

## Entries

### [11:30] Unhandled OpenAIError on every /api/copilotkit POST without a key
Attempted: Started the dev server with the new `/app/api/copilotkit/route.ts` (CopilotRuntime + OpenAIAdapter) and no `OPENAI_API_KEY` set anywhere (no `.env.local` exists yet). Sent a raw test POST to `/api/copilotkit` with an empty JSON body to confirm the route was live.
Error (paste exact text, don't paraphrase):
```
OpenAIError: The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).
    at new OpenAI (webpack-internal:///(rsc)/./node_modules/openai/index.mjs:92:19)
    at OpenAIAdapter.ensureOpenAI (webpack-internal:///(rsc)/./node_modules/@copilotkit/runtime/dist/service-adapters/openai/openai-adapter.mjs:53:37)
    at OpenAIAdapter.getLanguageModel (webpack-internal:///(rsc)/./node_modules/@copilotkit/runtime/dist/service-adapters/openai/openai-adapter.mjs:41:23)
    at eval (webpack-internal:///(rsc)/./node_modules/@copilotkit/runtime/dist/lib/runtime/copilot-runtime.mjs:144:60)
⨯ unhandledRejection: OpenAIError: ... (same trace, repeated 3x for one request)
```
The HTTP response itself was a clean `400 {"error":"invalid_request","message":"Missing method field"}` (correctly rejecting my malformed test payload before the GraphQL layer even ran) — but the OpenAI client instantiation still fired eagerly server-side and threw as an **unhandled promise rejection** in the server console, separate from the HTTP response.
Root cause: `OpenAIAdapter`'s constructor defers creating the underlying `OpenAI` client until `getLanguageModel()`/`ensureOpenAI()` is called, which happens as soon as `CopilotRuntime.handleServiceAdapter(serviceAdapter)` touches the adapter during request setup — this runs regardless of whether the request body is otherwise valid, and with no `OPENAI_API_KEY` in the environment, the OpenAI SDK's own constructor throws synchronously inside an async path that isn't wrapped in a try/catch by the runtime, so it surfaces as an unhandled rejection rather than a caught, client-facing error.
Fix: None needed in our code — this is expected, correct behavior for a missing key (confirmed intentional per DATA_SPEC.md's env table: "extraction/drafting hard-fail without it"). Not fixed, just confirmed and documented so the next session doesn't mistake these console errors for a bug in the new route. Resolves itself once a real `OPENAI_API_KEY` is added to `.env.local` — that is the actual blocker, tracked separately, not a code defect.
Time lost: ~5 min (spent confirming this was expected-given-no-key rather than a routing bug).

### [12:50] Correction to the entry above: "Missing method field" is not a GraphQL pre-check — this runtime speaks AG-UI, not GraphQL, at all
Attempted: With a real `OPENAI_API_KEY` finally in `.env.local`, tried to verify the CopilotKit wiring end-to-end without a browser (none available in this environment) by hand-sending a classic GraphQL `generateCopilotResponse` mutation — the protocol `@copilotkit/runtime-client-gql`'s `CopilotRuntimeClient` and the runtime README's older examples describe — directly to `/api/copilotkit`, using the SDK's own real generated query document (not hand-typed).
Error (paste exact text, don't paraphrase):
```
HTTP status: 400
RAW BODY:
 {"error":"invalid_request","message":"Missing method field"}
```
Root cause: the installed `@copilotkit/runtime@1.71.1` has removed GraphQL serving entirely (confirmed via `@copilotkit/runtime`'s own doc comment: "Nothing in this package serves GraphQL any more -- every v1 integration entry point delegates to the v2 Hono endpoint"). `copilotRuntimeNextJSAppRouterEndpoint` mounts a single-route Hono handler (`src/v2/runtime/endpoints/single-route-helpers.mjs`) that only understands a `{method, params, body}` JSON envelope with a fixed method whitelist (`agent/run`, `agent/suggest`, `agent/connect`, `agent/stop`, `info`, `inspector/metadata`, `inspector/learning`, `transcribe`, `resource/request`) — there is no GraphQL method in that list, so any GraphQL-shaped POST body is rejected as "missing method field" regardless of how well-formed the GraphQL itself is. Last task's entry above mis-described this exact response as "correctly rejecting my malformed test payload before the GraphQL layer even ran" — there is no GraphQL layer to run; that framing was wrong, corrected here.
Fix: Not a fix to the app — **the shipped code in `app/api/copilotkit/route.ts`, `app/layout.tsx`, and `app/page.tsx` was never touched and needed no change.** `@copilotkit/react-core`'s actual `<CopilotKit>` provider already speaks this same envelope protocol internally (confirmed by reading its compiled source: it negotiates `runtimeTransport: "single" | "rest" | "auto"`, defaulting to `"auto"`). The mismatch was only in my own verification script, which assumed the older documented GraphQL wire format. Corrected the script to send `{method: "agent/run", params: {agentId: "default"}, body: <AG-UI RunAgentInput>}` — `"default"` because `CopilotRuntime.handleServiceAdapter()` auto-registers a `BuiltInAgent` under that exact name when no explicit `agents` list is configured and the service adapter exposes a language model (true for our plain `OpenAIAdapter` setup) — confirmed by reading `handleServiceAdapter`'s source, not assumed. Validated the corrected request body against the real exported `RunAgentInputSchema` (from `@ag-ui/core`) before sending, so a subsequent failure would be the server's, not a self-inflicted malformed request. That corrected request succeeded end-to-end (see verification report) — real evidence the actual app wiring is correct.
Time lost: ~35 min (reading `single-route-helpers.mjs`, `fetch-handler.mjs`, `handle-run.mjs`, `copilot-runtime.mjs`, and `@ag-ui/core`'s schema to reconstruct the real protocol from source rather than guessing).
