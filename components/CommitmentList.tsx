"use client";
import { Commitment } from "@/lib/types";
import { riskLabel } from "@/lib/scoring";

const color = (score: number) => score >= 70 ? "#ff5874" : score >= 45 ? "#ffb54a" : score >= 25 ? "#63c7ff" : "#6ee7b7";

export function CommitmentList({ commitments, onDraft }: { commitments: Commitment[]; onDraft: (id: string) => Promise<unknown> }) {
  return (
    <section className="rounded-md border border-slate-300 bg-white dark:border-white/10 dark:bg-transparent">
      <div className="border-b border-slate-300 p-4 sm:px-5 dark:border-white/10">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-200">Tracked commitments</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-800 dark:text-slate-300">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs font-medium text-slate-600 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Source</th>
              <th className="px-5 py-2.5 w-full">Commitment</th>
              <th className="px-5 py-2.5">Owner</th>
              <th className="px-5 py-2.5">Due Date</th>
              <th className="px-5 py-2.5">Risk</th>
              <th className="px-5 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {commitments.map(c => (
              <tr key={c.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-5 py-3 text-xs uppercase text-slate-500">{c.sourceType}</td>
                <td className="px-5 py-3 text-sm font-medium">
                  <div className="line-clamp-1">{c.description}</div>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-400">{c.owner}</td>
                <td className="whitespace-nowrap px-5 py-3 font-mono text-slate-500 dark:text-slate-400">
                  {new Date(c.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
                </td>
                <td className="whitespace-nowrap px-5 py-3">
                  <span className="font-mono font-medium" style={{ color: color(c.riskScore) }}>
                    {c.riskScore.toString().padStart(2, '0')}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">{riskLabel(c.riskScore, c.status)}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  {c.status === "flagged" ? (
                    <span className="text-xs text-rose-600 dark:text-rose-300">Awaiting review</span>
                  ) : c.status === "escalated" ? (
                    <span className="text-xs text-cyan-700 dark:text-cyan-300">Sent</span>
                  ) : (
                    <button onClick={() => onDraft(c.id)} className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-500 dark:text-slate-300 dark:decoration-white/20 dark:hover:text-white dark:hover:decoration-white/60">
                      Draft escalation
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
