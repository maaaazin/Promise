import { NextRequest, NextResponse } from "next/server";
import { buildEscalationDraft } from "@/lib/drafts";
import { advanceClock, logDelivery, recompute, snapshot, updateCommitment } from "@/lib/store";
import { sendToSlack } from "@/lib/slack";

export async function GET() { return NextResponse.json(snapshot()); }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === "advance") return NextResponse.json(advanceClock(body.days ?? 3));
    if (body.action === "recompute") return NextResponse.json(recompute());
    const state = snapshot(); const commitment = state.commitments.find(c => c.id === body.id);
    if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    if (body.action === "draft") return NextResponse.json(updateCommitment(body.id, { status: "flagged", escalationDraft: buildEscalationDraft(commitment) }));
    if (body.action === "dismiss") return NextResponse.json(updateCommitment(body.id, { status: "tracked", escalationDraft: undefined }));
    if (body.action === "approve") {
      const text = String(body.text || commitment.escalationDraft || buildEscalationDraft(commitment));
      const delivery = await sendToSlack(text); updateCommitment(body.id, { status: "escalated", escalationDraft: text }); logDelivery(body.id, text, delivery.delivered);
      return NextResponse.json(snapshot());
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
