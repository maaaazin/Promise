export type CommitmentStatus = "tracked" | "flagged" | "escalated" | "resolved";
export type Commitment = {
  id: string; sourceType: "slack" | "email"; sourceExcerpt: string; owner: string;
  description: string; dueDate: string; lastActivityAt: string; riskScore: number;
  status: CommitmentStatus; escalationDraft?: string;
};
export type RadarState = { now: string; commitments: Commitment[]; sentMessages: { commitmentId: string; text: string; sentAt: string; delivered: boolean }[] };
