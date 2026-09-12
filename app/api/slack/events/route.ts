import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { join } from "path";
import { runExtraction } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Handle Slack URL Verification Challenge
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Process incoming Slack Events
    if (body.type === "event_callback" && body.event && body.event.type === "message") {
      const event = body.event;

      // Ignore messages from bots or sub-types like message_changed to prevent infinite loops
      if (event.bot_id || event.subtype) {
        return NextResponse.json({ ok: true });
      }

      const filePath = join(process.cwd(), "data", "seed-slack.json");
      const rawData = await fs.readFile(filePath, "utf8");
      const messages = JSON.parse(rawData);

      // Map raw user ID to author name (using ID directly as we discussed)
      const author = event.user; 
      
      const newMessage = {
        channel: event.channel,
        author: author,
        // Convert Slack Unix timestamp (string or number, often like "1726058098.000100") to ISO
        timestamp: new Date(parseFloat(event.ts) * 1000).toISOString(),
        text: event.text,
      };

      messages.push(newMessage);

      await fs.writeFile(filePath, JSON.stringify(messages, null, 2));

      // Trigger store refresh & extraction asynchronously (do not block Slack's 3-second timeout)
      runExtraction().catch((err) => console.error("Extraction failed after Slack ingest:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack Event Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
