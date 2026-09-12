import { NextRequest, NextResponse } from "next/server";
import { buildEscalationDraft } from "@/lib/drafts";
import { advanceClock, ingestMessage, logDelivery, recompute, runExtraction, snapshot, updateCommitment } from "@/lib/store";
import { sendToSlack } from "@/lib/slack";

export async function GET() { return NextResponse.json(await snapshot()); }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === "advance") return NextResponse.json(await advanceClock(body.days ?? 3));
    if (body.action === "recompute") return NextResponse.json(await recompute());
    if (body.action === "extract") return NextResponse.json(await runExtraction());
    if (body.action === "ingest") {
      const sourceType = body.sourceType === "email" ? "email" : body.sourceType === "slack" ? "slack" : undefined;
      const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
      if (!sourceType) return NextResponse.json({ error: "sourceType must be \"slack\" or \"email\"" }, { status: 400 });
      if (!rawText) return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      return NextResponse.json(await ingestMessage({ sourceType, rawText, author: body.author, timestamp: body.timestamp }));
    }
    const state = await snapshot(); const commitment = state.commitments.find(c => c.id === body.id);
    if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    if (body.action === "draft") return NextResponse.json(await updateCommitment(body.id, { status: "flagged", escalationDraft: await buildEscalationDraft(commitment) }));
    if (body.action === "dismiss") return NextResponse.json(await updateCommitment(body.id, { status: "tracked", escalationDraft: undefined }));
    if (body.action === "approve") {
      const text = String(body.text || commitment.escalationDraft || (await buildEscalationDraft(commitment)));
      const delivery = await sendToSlack(text); await updateCommitment(body.id, { status: "escalated", escalationDraft: text }); await logDelivery(body.id, text, delivery.delivered);
      return NextResponse.json(await snapshot());
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
