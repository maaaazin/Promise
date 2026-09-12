"use client";
import { Commitment } from "@/lib/types";
import { riskLabel } from "@/lib/scoring";

const color = (score: number) => score >= 70 ? "#ff5874" : score >= 45 ? "#ffb54a" : score >= 25 ? "#63c7ff" : "#6ee7b7";

export function RiskRadar({ commitments }: { commitments: Commitment[] }) {
  const sorted = [...commitments].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <section className="rounded-md border border-white/10 bg-transparent">
      <div className="border-b border-white/10 p-4 sm:px-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-200">Commitment radar</h2>
          <span className="font-mono text-xs text-slate-400">{commitments.length} signals tracked</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-white/5 bg-white/[0.02] text-xs font-medium text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Owner</th>
              <th className="px-5 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Risk Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map(c => (
              <tr key={c.id}>
                <td className="whitespace-nowrap px-5 py-3 font-medium">{c.owner}</td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-400">{riskLabel(c.riskScore)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right font-mono font-medium" style={{ color: color(c.riskScore) }}>
                  {c.riskScore.toString().padStart(2, '0')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
