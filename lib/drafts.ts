import { Commitment } from "./types";
export function buildEscalationDraft(c: Commitment) {
  return `Hi ${c.owner} — quick check-in on “${c.description},” due ${new Date(c.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}. The latest update suggests a dependency may be holding this up. Could you confirm the current status and, if needed, share a revised plan today so we can protect the timeline?`;
}
