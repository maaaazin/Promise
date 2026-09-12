import OpenAI from "openai";
import { Commitment } from "./types";

function formatDueDate(dueDate: string): string {
  return new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Used only if the live drafting call fails (no API key, API error, or empty content) — keeps
// the escalation flow running even when OpenAI is unreachable.
function fallbackDraft(c: Commitment): string {
  return `Hi ${c.owner} — quick check-in on "${c.description}," due ${formatDueDate(c.dueDate)}. The latest update suggests a dependency may be holding this up. Could you confirm the current status and, if needed, share a revised plan today so we can protect the timeline?`;
}

const SYSTEM_PROMPT = `You write short Slack escalation messages on behalf of a project lead, addressed directly to the person who made a work commitment that is now at risk of slipping.

Write 2-4 sentences. Be specific, not generic: reference the actual commitment, the actual due date, and the concrete reason it's flagged (how close the deadline is, how long it's been quiet, or urgency language found in the source). Do not write a generic "just checking in" reminder — make it clear why this particular commitment is being escalated now. End by asking for a concrete status update or revised plan. Output only the message text, no subject line, no signature.`;

export async function buildEscalationDraft(c: Commitment): Promise<string> {
  try {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            owner: c.owner,
            description: c.description,
            dueDate: c.dueDate,
            riskScore: c.riskScore,
            sourceExcerpt: c.sourceExcerpt,
          }),
        },
      ],
      temperature: 0.5,
    });

    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new Error("Draft completion returned no content");
    console.log(`[drafts] draft: live — generated escalation for ${c.id} (${c.owner})`);
    return text;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[drafts] draft: fallback — reason: ${reason}`);
    return fallbackDraft(c);
  }
}
