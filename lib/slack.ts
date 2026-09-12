export async function sendToSlack(text: string) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return { delivered: false, mode: "demo log" as const };
  const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  if (!response.ok) throw new Error(`Slack delivery failed (${response.status})`);
  return { delivered: true, mode: "slack" as const };
}
