"use client";
import { useEffect, useState } from "react";
import { RiskRadar } from "@/components/RiskRadar";
import { CommitmentList } from "@/components/CommitmentList";
import { EscalationCard } from "@/components/EscalationCard";
import { RadarState } from "@/lib/types";

export default function Dashboard() {
 const [state, setState] = useState<RadarState>(); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
 async function api(action: string, id?: string, text?: string) { setError(""); const r = await fetch("/api/radar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id, text }) }); const body = await r.json(); if (!r.ok) { setError(body.error || "Something went wrong"); return; } setState(body); }
 useEffect(() => { fetch("/api/radar").then(r => r.json()).then(setState).catch(() => setError("Could not load the radar.")).finally(() => setLoading(false)); }, []);
 if (loading) return <main className="grid min-h-screen place-items-center text-slate-300">Calibrating commitment radar…</main>;
 if (!state) return <main className="grid min-h-screen place-items-center text-rose-300">{error}</main>;
 const flagged = state.commitments.filter(c => c.status === "flagged" && c.escalationDraft);
 return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#18244a,_#080b13_55%)] px-5 py-8 sm:px-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-300"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />Deadline Radar</div><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Commitments don’t disappear.<br/><span className="text-slate-400">They surface before they slip.</span></h1></div><div className="flex flex-col items-start gap-2 sm:items-end"><p className="text-xs text-slate-400">Mock time · {new Date(state.now).toLocaleDateString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</p><button onClick={() => api("advance")} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-white/10 hover:bg-cyan-100">Simulate 3 days passing →</button></div></header>
 {error && <p className="mb-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
 <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]"><RiskRadar commitments={state.commitments} /><div className="space-y-4">{flagged.length ? flagged.map(c => <EscalationCard key={c.id} commitment={c} onAction={(a, id, text) => api(a, id, text)} />) : <section className="rounded-3xl border border-dashed border-white/15 bg-white/[.02] p-6"><p className="font-semibold text-slate-200">No escalation awaiting review</p><p className="mt-2 text-sm leading-relaxed text-slate-400">Advance the mock clock to let the agent identify a slipping commitment and prepare a context-aware message for your approval.</p></section>}</div></div>
 <div className="mt-6"><CommitmentList commitments={state.commitments} onDraft={id => api("draft", id)} /></div><p className="mt-5 text-center text-xs text-slate-500">Human approval is required before delivery. Without a Slack webhook, sent messages are safely logged in demo mode.</p></div></main>;
}
