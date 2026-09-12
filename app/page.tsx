"use client";
import { useEffect, useRef, useState } from "react";
import { useCopilotAction, useCopilotChat, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { RiskRadar } from "@/components/RiskRadar";
import { CommitmentList } from "@/components/CommitmentList";
import { EscalationCard } from "@/components/EscalationCard";
import { RadarState } from "@/lib/types";

async function callRadar(body: Record<string, unknown>): Promise<RadarState> {
  const r = await fetch("/api/radar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "Something went wrong");
  return json as RadarState;
}

export default function Dashboard() {
  const [state, setState] = useState<RadarState>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [ingestSource, setIngestSource] = useState<"slack" | "email">("slack");
  const [ingestResult, setIngestResult] = useState("");
  const { appendMessage } = useCopilotChat();
  // AG-UI requires a pending tool call's result before the thread can accept a new message —
  // sending a second nudge while an earlier one's approveEscalation call is still unresolved
  // throws "Tool result is missing for tool call ...". These track the single in-flight nudge
  // and queue any others until it resolves (via approve or dismiss).
  const pendingNudgeIdRef = useRef<string | null>(null);
  const nudgeQueueRef = useRef<{ id: string; owner: string; draft: string }[]>([]);

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setError("Could not load the radar."))
      .finally(() => setLoading(false));
  }, []);

  useCopilotReadable(
    {
      description:
        "The live Deadline Radar state: mock current time, and every tracked commitment with its owner, description, due date, riskScore (0-100, higher = more likely to slip), status (tracked/flagged/escalated/resolved), and escalation draft if one exists.",
      value: state || "Loading...",
    },
    [state]
  );

  async function sendNudge(commitmentId: string, owner: string, draft: string) {
    try {
      await appendMessage(
        new TextMessage({
          role: Role.User,
          content: `Commitment ${commitmentId} (owner: ${owner}) just crossed the risk threshold and has a drafted escalation message ready for review: "${draft}". Call approveEscalation for commitment ${commitmentId} now so I can review and approve or dismiss it.`,
        })
      );
    } catch {
      // Non-fatal: the draft still saved to the store; the user can ask the sidebar to review it manually.
    }
  }

  // Sends the next queued nudge, but only if no nudge-triggered tool call is currently pending —
  // otherwise the chat thread would get a second message before the first tool call has a result.
  function sendNextQueuedNudge() {
    if (pendingNudgeIdRef.current) return;
    const next = nudgeQueueRef.current.shift();
    if (!next) return;
    pendingNudgeIdRef.current = next.id;
    void sendNudge(next.id, next.owner, next.draft);
  }

  // Single entry point for every "nudge the sidebar to review this commitment" call (auto-flag
  // and manual draft alike). Queues instead of sending immediately when a prior nudge's tool
  // call hasn't been resolved yet, so at most one nudge-triggered approval is ever in flight.
  function nudgeApproval(commitmentId: string, owner: string, draft: string) {
    const alreadyQueuedOrPending = pendingNudgeIdRef.current === commitmentId || nudgeQueueRef.current.some((q) => q.id === commitmentId);
    if (!alreadyQueuedOrPending) nudgeQueueRef.current.push({ id: commitmentId, owner, draft });
    sendNextQueuedNudge();
  }

  // Called once a nudge-triggered (or manually drafted) commitment leaves "flagged" — approved
  // or dismissed — so the next queued nudge, if any, can be sent.
  function resolveNudge(commitmentId: string) {
    if (pendingNudgeIdRef.current === commitmentId) {
      pendingNudgeIdRef.current = null;
      sendNextQueuedNudge();
    }
  }

  // Auto-triggered flags (threshold crossed during advance/recompute, no manual draft click) —
  // diffed against the state captured just before the call resolved. Queues every newly-flagged
  // commitment, riskiest first; nudgeApproval/sendNextQueuedNudge take care of not overlapping.
  function nudgeAutoFlagged(prev: RadarState | undefined, next: RadarState) {
    const newlyFlagged = next.commitments.filter((c) => {
      if (c.status !== "flagged" || !c.escalationDraft) return false;
      const before = prev?.commitments.find((x) => x.id === c.id);
      return before?.status !== "flagged";
    });
    for (const c of newlyFlagged.sort((a, b) => b.riskScore - a.riskScore)) nudgeApproval(c.id, c.owner, c.escalationDraft!);
  }

  async function handleDraft(commitmentId: string) {
    setError("");
    try {
      const next = await callRadar({ action: "draft", id: commitmentId });
      setState(next);
      const c = next.commitments.find((x) => x.id === commitmentId);
      if (c?.escalationDraft) void nudgeApproval(c.id, c.owner, c.escalationDraft);
      return c ? `Draft ready for ${c.owner}: "${c.escalationDraft}"` : "Commitment not found.";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  }

  async function handleDismiss(commitmentId: string) {
    setError("");
    try {
      const next = await callRadar({ action: "dismiss", id: commitmentId });
      setState(next);
      resolveNudge(commitmentId);
      return "Dismissed — back to tracked.";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  }

  async function handleAdvance() {
    setError("");
    try {
      const prev = state;
      const next = await callRadar({ action: "advance" });
      setState(next);
      nudgeAutoFlagged(prev, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function handleIngest(input: { sourceType: "slack" | "email"; rawText: string; author?: string; timestamp?: string }): Promise<string> {
    setError("");
    try {
      const prev = state;
      const next = await callRadar({ action: "ingest", ...input });
      setState(next);
      const prevIds = new Set(prev?.commitments.map((c) => c.id));
      const added = next.commitments.find((c) => !prevIds.has(c.id));
      return added
        ? `Ingested a new tracked commitment: ${added.owner} — "${added.description}" due ${added.dueDate} (risk ${added.riskScore}).`
        : "No commitment detected in that message — nothing added.";
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      throw e;
    }
  }

  async function handleIngestSubmit() {
    if (!ingestText.trim()) return;
    setIngestResult("");
    try {
      const result = await handleIngest({ sourceType: ingestSource, rawText: ingestText });
      setIngestResult(result);
      setIngestText("");
    } catch {
      // error state already set by handleIngest
    }
  }

  useCopilotAction(
    {
      name: "extractCommitments",
      description:
        "Re-run extraction over the seed Slack and email messages and refresh the commitment store with the results. Falls back to the last known commitments if extraction fails (e.g. no API key).",
      parameters: [],
      handler: async () => {
        const next = await callRadar({ action: "extract" });
        setState(next);
        return `Extraction complete — the store now holds ${next.commitments.length} commitment(s).`;
      },
    },
    [state]
  );

  useCopilotAction(
    {
      name: "recomputeRisk",
      description: "Recalculate the risk score for every tracked commitment against the current mock clock time.",
      parameters: [],
      handler: async () => {
        const prev = state;
        const next = await callRadar({ action: "recompute" });
        setState(next);
        nudgeAutoFlagged(prev, next);
        const top = [...next.commitments].sort((a, b) => b.riskScore - a.riskScore)[0];
        return top ? `Recomputed. Highest risk right now: ${top.owner} — "${top.description}" at ${top.riskScore}.` : "Recomputed. No commitments tracked.";
      },
    },
    [state]
  );

  useCopilotAction(
    {
      name: "ingestMessage",
      description:
        "Ingest a single raw Slack or email message that isn't part of the seed data (e.g. one pasted into this chat) and extract a commitment from it if one exists, adding it to the live tracked commitments so it's included in future risk recomputation. If no genuine commitment is found, nothing is added.",
      parameters: [
        { name: "sourceType", type: "string", description: "Where the message came from: \"slack\" or \"email\".", required: true },
        { name: "rawText", type: "string", description: "The raw message text to extract a commitment from.", required: true },
        { name: "author", type: "string", description: "Display name of the message's author, if known.", required: false },
        { name: "timestamp", type: "string", description: "ISO timestamp the message was sent, if known. Defaults to the current mock clock time.", required: false },
      ],
      handler: async ({ sourceType, rawText, author, timestamp }) =>
        handleIngest({ sourceType: sourceType === "email" ? "email" : "slack", rawText, author, timestamp }),
    },
    [state]
  );

  useCopilotAction(
    {
      name: "draftEscalation",
      description: "Draft an escalation message for a specific commitment and flag it for human approval.",
      parameters: [{ name: "commitmentId", type: "string", description: "The id of the commitment to draft an escalation for.", required: true }],
      handler: async ({ commitmentId }) => handleDraft(commitmentId),
    },
    [state]
  );

  useCopilotAction(
    {
      name: "dismissFlag",
      description: "Dismiss a flagged commitment's escalation draft and return it to tracked status, without sending anything.",
      parameters: [{ name: "commitmentId", type: "string", description: "The id of the commitment to dismiss.", required: true }],
      handler: async ({ commitmentId }) => handleDismiss(commitmentId),
    },
    [state]
  );

  useCopilotAction(
    {
      name: "approveEscalation",
      description:
        "Show the drafted escalation message to the human for approval before sending. Only call this for a commitment that already has a draft (status flagged).",
      parameters: [
        { name: "commitmentId", type: "string", description: "The id of the commitment awaiting approval.", required: true },
        { name: "editedText", type: "string", description: "Optional edited escalation text to show instead of the original draft.", required: false },
      ],
      renderAndWaitForResponse: ({ args, status, respond }) => {
        const commitment = args.commitmentId ? state?.commitments.find((c) => c.id === args.commitmentId) : undefined;
        if (!commitment) {
          return <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">Preparing escalation review…</p>;
        }
        return (
          <EscalationCard
            commitment={commitment}
            initialText={args.editedText || commitment.escalationDraft || ""}
            disabled={status !== "executing"}
            onApprove={async (text) => {
              const next = await callRadar({ action: "approve", id: commitment.id, text });
              setState(next);
              resolveNudge(commitment.id);
              respond?.({ approved: true, deliveredText: text });
            }}
            onDismiss={async () => {
              await handleDismiss(commitment.id);
              respond?.({ approved: false });
            }}
          />
        );
      },
    },
    [state]
  );

  if (loading) return <main className="grid min-h-screen place-items-center text-slate-300">Calibrating commitment radar…</main>;
  if (!state) return <main className="grid min-h-screen place-items-center text-rose-300">{error}</main>;

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#3DD6C4]" />
              Deadline Radar
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Commitments don’t disappear.
              <br />
              <span className="text-slate-400">They surface before they slip.</span>
            </h1>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="font-mono text-xs text-slate-400">
              Mock time · {new Date(state.now).toLocaleDateString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={handleAdvance} className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10">
              Simulate 3 days passing
            </button>
          </div>
        </header>
        {error && <p className="mb-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        <RiskRadar commitments={state.commitments} />
        <div className="mt-6">
          <CommitmentList commitments={state.commitments} onDraft={handleDraft} />
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-cyan-300">Manually ingest a message</p>
          <p className="mt-1 text-xs text-slate-400">
            Non-chat fallback: paste a raw Slack or email message here to extract and track a commitment from it, without going through the sidebar.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={ingestSource}
              onChange={(e) => setIngestSource(e.target.value === "email" ? "email" : "slack")}
              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:w-32"
            >
              <option value="slack">Slack</option>
              <option value="email">Email</option>
            </select>
            <input
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
              placeholder={'e.g. "I\'ll ship the report by Monday"'}
              className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <button
              onClick={handleIngestSubmit}
              disabled={!ingestText.trim()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-white/10 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ingest
            </button>
          </div>
          {ingestResult && <p className="mt-2 text-xs text-slate-400">{ingestResult}</p>}
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">
          Human approval is required before delivery. Flagged commitments are reviewed and approved from the chat sidebar. Without a Slack webhook, sent messages
          are safely logged in demo mode.
        </p>
      </div>
      <CopilotSidebar
        labels={{ title: "Deadline Radar Agent", initial: "Ask me what's at risk, or approve an escalation that's ready for review." }}
        instructions="You help the user track and act on work commitments extracted from Slack/email. Use the live commitment state you're given to answer grounded questions. Use recomputeRisk, draftEscalation, dismissFlag, and approveEscalation to act on commitments — always call approveEscalation to get human sign-off before anything is treated as sent."
      />
    </main>
  );
}
