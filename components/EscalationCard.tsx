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
    <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-400/30 dark:bg-rose-400/5">
      <div className="flex gap-3">
        <span className="mt-0.5 text-lg">✦</span>
        <div>
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Escalation ready for approval</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Risk crossed the action threshold for {commitment.owner}’s commitment.</p>
        </div>
      </div>
      <textarea
        className="mt-4 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 outline-none focus:border-cyan-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:focus:border-cyan-300/60"
        value={text}
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex gap-3">
        <button disabled={locked} onClick={approve} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 dark:bg-cyan-300 dark:text-slate-950">
          Approve &amp; send
        </button>
        <button disabled={locked} onClick={dismiss} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60 dark:border-white/15 dark:text-slate-300">
          Dismiss
        </button>
      </div>
    </article>
  );
}
