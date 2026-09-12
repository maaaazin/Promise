import { scoreRisk } from "./scoring";
import { Commitment, RadarState } from "./types";

const initial: Omit<Commitment, "riskScore">[] = [
  { id: "c-launch", sourceType: "slack", owner: "Maya Chen", description: "Ship the final launch email and analytics links", dueDate: "2026-09-15", lastActivityAt: "2026-09-08T14:00:00Z", status: "tracked", sourceExcerpt: "I'll get the final launch email and the analytics links to you by Tuesday. The UTM report is still blocked on the final naming pass." },
  { id: "c-pricing", sourceType: "email", owner: "Jordan Ellis", description: "Send the updated enterprise pricing page to Acme", dueDate: "2026-09-19", lastActivityAt: "2026-09-10T09:30:00Z", status: "tracked", sourceExcerpt: "I can send Acme the revised pricing page by Friday once legal confirms the regional terms." },
  { id: "c-mobile", sourceType: "slack", owner: "Priya Nair", description: "Complete mobile regression testing", dueDate: "2026-09-22", lastActivityAt: "2026-09-11T12:15:00Z", status: "tracked", sourceExcerpt: "I’ll finish the mobile regression sweep before next Wednesday and post the results in this channel." },
  { id: "c-brief", sourceType: "email", owner: "Alex Morgan", description: "Provide the customer research brief", dueDate: "2026-09-26", lastActivityAt: "2026-09-11T16:45:00Z", status: "tracked", sourceExcerpt: "I’ll share the customer research brief by the end of next week." }
];

let state: RadarState | undefined;
function getState() {
  if (!state) {
    const now = new Date("2026-09-12T10:00:00Z");
    state = { now: now.toISOString(), commitments: initial.map(c => ({ ...c, riskScore: scoreRisk(c as Commitment, now) })), sentMessages: [] };
  }
  return state;
}
export function snapshot() { return structuredClone(getState()); }
export function recompute() { const s = getState(); const now = new Date(s.now); s.commitments.forEach(c => c.riskScore = scoreRisk(c, now)); return snapshot(); }
export function advanceClock(days = 3) { const s = getState(); const date = new Date(s.now); date.setDate(date.getDate() + days); s.now = date.toISOString(); return recompute(); }
export function updateCommitment(id: string, update: Partial<Commitment>) { const c = getState().commitments.find(x => x.id === id); if (!c) throw new Error("Commitment not found"); Object.assign(c, update); return snapshot(); }
export function logDelivery(commitmentId: string, text: string, delivered: boolean) { const s = getState(); s.sentMessages.unshift({ commitmentId, text, delivered, sentAt: new Date().toISOString() }); return snapshot(); }
