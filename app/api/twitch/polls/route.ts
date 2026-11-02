import { NextResponse } from "next/server";
import { z } from "zod";
import { validOverlayKey } from "@/lib/bloub-store";
import { POLL_SCOPES, readTwitchSession, twitchApiFetch } from "@/lib/twitch-server";

export const runtime = "nodejs";

const PollRequestSchema = z.object({
  key: z.string(),
  title: z.string().trim().min(1).max(60),
  choices: z.array(z.string().trim().min(1).max(25)).min(2).max(5),
  duration: z.number().int().min(15).max(1800),
}).strict();

export async function POST(request: Request) {
  const input = PollRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !validOverlayKey(input.data.key)) {
    return NextResponse.json({ error: "Enter a question and 2–5 choices." }, { status: 400 });
  }
  const session = await readTwitchSession(input.data.key);
  if (!session) return NextResponse.json({ error: "Connect the broadcaster’s Twitch account first." }, { status: 401 });
  if (!POLL_SCOPES.every((scope) => session.scopes.includes(scope))) {
    return NextResponse.json({ error: "Reconnect Twitch and approve poll permissions." }, { status: 403 });
  }

  const { response } = await twitchApiFetch(input.data.key, "/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      broadcaster_id: session.userId,
      title: input.data.title,
      choices: input.data.choices.map((title) => ({ title })),
      duration: input.data.duration,
    }),
  });
  const body = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | { message?: string } | null;
  if (!response.ok) {
    const twitchMessage = body && "message" in body && body.message ? body.message : "";
    const channelCannotPoll = response.status === 403 && /not a partner or affiliate/i.test(twitchMessage);
    const error = channelCannotPoll
      ? "Twitch only allows polls on Affiliate and Partner channels. Chat replies and the mascot overlay can still work on this channel."
      : twitchMessage || (response.status === 403
        ? "Twitch denied poll creation. Check channel eligibility and poll permissions."
        : "Twitch could not create the poll.");
    return NextResponse.json({ error }, { status: response.status });
  }
  return NextResponse.json({ created: true, id: body && "data" in body ? body.data?.[0]?.id ?? null : null });
}
