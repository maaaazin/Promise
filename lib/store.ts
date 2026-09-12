import { scoreRisk } from "./scoring";
import { extractCommitments, SeedMessage } from "./extraction";
import { buildEscalationDraft } from "./drafts";
import { Commitment, RadarState } from "./types";
import { readFileSync } from "fs";
import { join } from "path";

// Used only if live extraction fails (no API key, API error, or zero commitments survive
// the confidence floor) — keeps the demo running even when OpenAI is unreachable.
const FALLBACK_COMMITMENTS: Omit<Commitment, "riskScore">[] = [
  { id: "c-launch", sourceType: "slack", owner: "Maya Chen", description: "Ship the final launch email and analytics links", dueDate: "2026-09-15", lastActivityAt: "2026-09-08T14:00:00Z", status: "tracked", sourceExcerpt: "I'll get the final launch email and the analytics links to you by Tuesday. The UTM report is still blocked on the final naming pass." },
  { id: "c-pricing", sourceType: "email", owner: "Jordan Ellis", description: "Send the updated enterprise pricing page to Acme", dueDate: "2026-09-19", lastActivityAt: "2026-09-10T09:30:00Z", status: "tracked", sourceExcerpt: "I can send Acme the revised pricing page by Friday once legal confirms the regional terms." },
  { id: "c-mobile", sourceType: "slack", owner: "Priya Nair", description: "Complete mobile regression testing", dueDate: "2026-09-22", lastActivityAt: "2026-09-11T12:15:00Z", status: "tracked", sourceExcerpt: "I’ll finish the mobile regression sweep before next Wednesday and post the results in this channel." },
  { id: "c-brief", sourceType: "email", owner: "Alex Morgan", description: "Provide the customer research brief", dueDate: "2026-09-26", lastActivityAt: "2026-09-11T16:45:00Z", status: "tracked", sourceExcerpt: "I’ll share the customer research brief by the end of next week." }
];

type SlackSeedEntry = { channel: string; author: string; timestamp: string; text: string };
type EmailSeedEntry = { threadId: string; from: string; to: string; subject: string; timestamp: string; body: string };

function loadSeedMessages(): SeedMessage[] {
  const seedSlackRaw = readFileSync(join(process.cwd(), "data", "seed-slack.json"), "utf8");
  const seedEmailRaw = readFileSync(join(process.cwd(), "data", "seed-email.json"), "utf8");
  const seedSlack = JSON.parse(seedSlackRaw);
  const seedEmail = JSON.parse(seedEmailRaw);

  const slack = (seedSlack as SlackSeedEntry[]).map((m, i) => ({ id: `slack-${i}`, sourceType: "slack" as const, author: m.author, timestamp: m.timestamp, text: m.text }));
  const email = (seedEmail as EmailSeedEntry[]).map((m, i) => ({ id: `email-${i}`, sourceType: "email" as const, author: m.from, timestamp: m.timestamp, text: m.body }));
  return [...slack, ...email];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "owner";
}

async function loadInitialCommitments(): Promise<Omit<Commitment, "riskScore">[]> {
  const messages = loadSeedMessages();
  try {
    const extracted = await extractCommitments(messages);
    if (extracted.length === 0) throw new Error("extraction returned zero commitments above the confidence floor");
    const commitments = extracted.map((item, index) => {
      const source = messages.find((m) => m.id === item.sourceMessageId);
      return {
        id: `c-${slugify(item.owner)}-${index}`,
        sourceType: source?.sourceType ?? "slack",
        sourceExcerpt: item.sourceExcerpt,
        owner: item.owner,
        description: item.description,
        dueDate: item.dueDate,
        lastActivityAt: source?.timestamp ?? new Date().toISOString(),
        status: item.isResolved ? "resolved" : "tracked",
      };
    });
    console.log(`[store] extraction: live — ${commitments.length} commitment(s) extracted from ${messages.length} seed messages`);
    return commitments;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[store] extraction: fallback — reason: ${reason}`);
    return FALLBACK_COMMITMENTS;
  }
}

function buildState(commitments: Omit<Commitment, "riskScore">[], now: Date): RadarState {
  return { now: now.toISOString(), commitments: commitments.map((c) => ({ ...c, riskScore: scoreRisk(c as Commitment, now) })), sentMessages: [] };
}

let statePromise: Promise<RadarState> | undefined;

function getState(): Promise<RadarState> {
  if (!statePromise) {
    statePromise = (async () => {
      const now = new Date("2026-09-12T10:00:00Z");
      const commitments = await loadInitialCommitments();
      return buildState(commitments, now);
    })();
  }
  return statePromise;
}

export async function snapshot(): Promise<RadarState> { return structuredClone(await getState()); }

const FLAG_THRESHOLD = 70;

export async function recompute(): Promise<RadarState> {
  const s = await getState();
  const now = new Date(s.now);

  // Only commitments still "tracked" that cross the flag threshold in this call auto-draft —
  // already-flagged/escalated/resolved commitments are left alone, and a recompute with no
  // crossing makes zero LLM calls.
  const newlyCrossed: Commitment[] = [];
  s.commitments.forEach((c) => {
    const previousScore = c.riskScore;
    c.riskScore = scoreRisk(c, now);
    if (c.status === "tracked" && previousScore < FLAG_THRESHOLD && c.riskScore >= FLAG_THRESHOLD) {
      newlyCrossed.push(c);
    }
  });

  for (const c of newlyCrossed) {
    c.escalationDraft = await buildEscalationDraft(c);
    c.status = "flagged";
  }

  return snapshot();
}

export async function advanceClock(days = 3): Promise<RadarState> {
  const s = await getState();
  const date = new Date(s.now);
  date.setDate(date.getDate() + days);
  s.now = date.toISOString();
  return recompute();
}

export async function updateCommitment(id: string, update: Partial<Commitment>): Promise<RadarState> {
  const s = await getState();
  const c = s.commitments.find((x) => x.id === id);
  if (!c) throw new Error("Commitment not found");
  Object.assign(c, update);
  return snapshot();
}

export async function logDelivery(commitmentId: string, text: string, delivered: boolean): Promise<RadarState> {
  const s = await getState();
  s.sentMessages.unshift({ commitmentId, text, delivered, sentAt: new Date().toISOString() });
  return snapshot();
}

// Re-runs extraction on demand (e.g. from the extractCommitments CopilotKit action) against
// the store's current mock clock, replacing the commitment list. Falls back the same way
// startup initialization does if the live call fails.
export async function runExtraction(): Promise<RadarState> {
  const s = await getState();
  const now = new Date(s.now);
  const commitments = await loadInitialCommitments();
  s.commitments = commitments.map((c) => ({ ...c, riskScore: scoreRisk(c as Commitment, now) }));
  return snapshot();
}

export type IngestInput = { sourceType: "slack" | "email"; rawText: string; author?: string; timestamp?: string };

// Runs the same single-message extraction the seed pipeline uses against one manually-supplied
// message (e.g. pasted into the sidebar chat or typed into the dashboard's ingest form) and, if
// it clears the confidence floor, adds a new commitment straight into the live store so it
// participates in future recompute()/advanceClock() auto-flagging like any other commitment.
export async function ingestMessage(input: IngestInput): Promise<RadarState> {
  const s = await getState();
  const timestamp = input.timestamp ?? s.now;
  const message: SeedMessage = { id: `ingest-${Date.now()}`, sourceType: input.sourceType, author: input.author ?? "unknown", timestamp, text: input.rawText };

  const extracted = await extractCommitments([message]);
  if (extracted.length === 0) {
    console.log(`[ingest] no commitment found in message`);
    return snapshot();
  }

  const item = extracted[0];
  const now = new Date(s.now);
  const commitment: Commitment = {
    id: `c-${slugify(item.owner)}-ingest-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sourceType: input.sourceType,
    sourceExcerpt: item.sourceExcerpt,
    owner: item.owner,
    description: item.description,
    dueDate: item.dueDate,
    lastActivityAt: timestamp,
    status: item.isResolved ? "resolved" : "tracked",
    riskScore: 0,
  };
  commitment.riskScore = scoreRisk(commitment, now);
  s.commitments.push(commitment);
  console.log(`[ingest] extracted commitment from ${input.sourceType} message`);
  return snapshot();
}
