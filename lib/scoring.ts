import { Commitment } from "./types";

export function scoreRisk(commitment: Commitment, now = new Date()): number {
  const due = new Date(`${commitment.dueDate}T17:00:00`);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  const quietDays = Math.max(0, Math.floor((now.getTime() - new Date(commitment.lastActivityAt).getTime()) / 86_400_000));
  const urgency = /urgent|blocked|delay|slip|waiting|risk|asap/i.test(commitment.sourceExcerpt) ? 13 : 0;
  const deadlineRisk = daysLeft <= 0 ? 52 : daysLeft <= 1 ? 43 : daysLeft <= 3 ? 31 : daysLeft <= 7 ? 17 : 5;
  return Math.max(0, Math.min(100, Math.round(deadlineRisk + Math.min(30, quietDays * 5) + urgency)));
}

export const riskLabel = (score: number) => score >= 70 ? "Critical" : score >= 45 ? "At risk" : score >= 25 ? "Watch" : "On track";
