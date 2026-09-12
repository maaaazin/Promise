"use client";
import { useState } from "react";
import { Commitment } from "@/lib/types";

export function EscalationCard({
  commitment,
  initialText,
  disabled,
  onApprove,
  onDismiss,
}: {
  commitment: Commitment;
  initialText: string;
  disabled: boolean;
  onApprove: (text: string) => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const locked = disabled || busy;

  async function approve() {
    setBusy(true);
    try {
      await onApprove(text);
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      await onDismiss();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 text-lg">✦</span>
        <div>
          <p className="text-sm font-semibold text-rose-200">Escalation ready for approval</p>
          <p className="mt-1 text-sm text-slate-400">Risk crossed the action threshold for {commitment.owner}’s commitment.</p>
        </div>
      </div>
      <textarea
        className="mt-4 min-h-28 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-slate-200 outline-none focus:border-cyan-300/60"
        value={text}
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex gap-3">
        <button disabled={locked} onClick={approve} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-60">
          Approve &amp; send
        </button>
        <button disabled={locked} onClick={dismiss} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 disabled:opacity-60">
          Dismiss
        </button>
      </div>
    </article>
  );
}
