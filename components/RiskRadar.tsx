"use client";
import { Commitment } from "@/lib/types";
import { riskLabel } from "@/lib/scoring";

const color = (score: number) => score >= 70 ? "#ff5874" : score >= 45 ? "#ffb54a" : score >= 25 ? "#63c7ff" : "#6ee7b7";
export function RiskRadar({ commitments }: { commitments: Commitment[] }) {
  return <section className="rounded-3xl border border-white/10 bg-[#101624] p-6 shadow-2xl shadow-black/20"><div className="mb-6 flex items-baseline justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Live risk field</p><h2 className="mt-1 text-xl font-semibold">Commitment radar</h2></div><span className="text-sm text-slate-400">{commitments.length} signals tracked</span></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{commitments.map(c => <div key={c.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#080c16] p-4"><div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-xl" style={{ background: color(c.riskScore) }} /><p className="text-xs text-slate-400">{riskLabel(c.riskScore)}</p><p className="mt-3 text-3xl font-bold" style={{ color: color(c.riskScore) }}>{c.riskScore}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${c.riskScore}%`, background: color(c.riskScore) }} /></div><p className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-slate-200">{c.owner}</p></div>)}</div>
  </section>;
}
