import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export type SeedMessage = {
  id: string;
  sourceType: "slack" | "email";
  author: string;
  timestamp: string;
  text: string;
};

export type ExtractedCommitment = {
  sourceMessageId: string;
  owner: string;
  description: string;
  dueDate: string;
  confidence: number;
  sourceExcerpt: string;
};

// Below this, treat the extraction as too vague or ambiguous to act on and discard it
// rather than force a low-confidence commitment into the store.
export const CONFIDENCE_FLOOR = 0.6;

const ExtractionItem = z.object({
  sourceMessageId: z.string().describe("The id of the source message, exactly as given in the input."),
  owner: z.string().describe("Display name of the person making the commitment."),
  description: z.string().describe("Short description of what was committed to."),
  dueDate: z.string().describe("Absolute due date in YYYY-MM-DD format."),
  confidence: z.number().min(0).max(1).describe("0-1 confidence this is a genuine, actionable commitment with a resolvable due date."),
  sourceExcerpt: z.string().describe("The exact quoted phrase from the message containing the commitment."),
});

const ExtractionResult = z.object({ commitments: z.array(ExtractionItem) });

const SYSTEM_PROMPT = `You extract real work commitments from raw Slack messages and emails.

A commitment is a specific person promising to deliver something by some point in time — e.g. "I'll get X to you by Friday", "I can turn this around by end of next week". It is NOT a question, an acknowledgment, a status update with no promise, or social chatter. Do not include an entry for a message with no genuine commitment.

Every input message has its own "timestamp". For any relative date phrasing in that message ("by Friday", "end of next week", "next Wednesday"), resolve it into an absolute date in YYYY-MM-DD format using THAT MESSAGE'S OWN timestamp as "today" — never the current real date, and never another message's timestamp.

If a message contains a real commitment but you cannot confidently resolve a specific due date, still return it with your best-guess date and a confidence of 0.4 or lower.

Score confidence 0-1: how sure you are this is a genuine, actionable commitment with a resolvable due date. Give a low score (well under 0.5) to anything vague, hedged, or without a real deliverable.

Quote the exact phrase containing the commitment as sourceExcerpt. Set owner to the person's display name: capitalize a bare first name (e.g. "sam" -> "Sam"), or turn a "firstname.lastname@..." email into "Firstname Lastname".`;

export async function extractCommitments(messages: SeedMessage[]): Promise<ExtractedCommitment[]> {
  if (messages.length === 0) return [];

  const client = new OpenAI();
  const completion = await client.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify(
          messages.map((m) => ({ id: m.id, timestamp: m.timestamp, author: m.author, text: m.text })),
          null,
          2
        ),
      },
    ],
    response_format: zodResponseFormat(ExtractionResult, "commitment_extraction"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("Extraction returned no parsed content");

  return parsed.commitments.filter((c) => c.confidence >= CONFIDENCE_FLOOR);
}
