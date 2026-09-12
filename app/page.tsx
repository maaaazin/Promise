"use client";
import { useEffect, useState } from "react";
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
  const { appendMessage } = useCopilotChat();

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
      value: state,
    },
    [state]
  );

  async function nudgeApproval(commitmentId: string, owner: string, draft: string) {
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

  // Auto-triggered flags (threshold crossed during advance/recompute, no manual draft click)
  // reuse this same nudge — diffed against the state captured just before the call resolved.
  function nudgeAutoFlagged(prev: RadarState | undefined, next: RadarState) {
    const newlyFlagged = next.commitments.filter(c => {
      if (c.status !== "flagged" || !c.escalationDraft) return false;
      const before = prev?.commitments.find((x) => x.id === c.id);
      return before?.status !== "flagged";
    });
    
    if (newlyFlagged.length === 0) return;
    
    // Only nudge the riskiest one to avoid overwhelming the Copilot chat with multiple simultaneous approvals
    const top = newlyFlagged.sort((a, b) => b.riskScore - a.riskScore)[0];
    void nudgeApproval(top.id, top.owner, top.escalationDraft!);
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#18244a,_#080b13_55%)] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              Deadline Radar
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Commitments don’t disappear.
              <br />
              <span className="text-slate-400">They surface before they slip.</span>
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-xs text-slate-400">
              Mock time · {new Date(state.now).toLocaleDateString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            <button onClick={handleAdvance} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-white/10 hover:bg-cyan-100">
              Simulate 3 days passing →
            </button>
          </div>
        </header>
        {error && <p className="mb-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        <RiskRadar commitments={state.commitments} />
        <div className="mt-6">
          <CommitmentList commitments={state.commitments} onDraft={handleDraft} />
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
