import { NextResponse } from "next/server";
import { z } from "zod";
import { validOverlayKey } from "@/lib/bloub-store";
import { clearTwitchSession, getTwitchConfig, readTwitchSession } from "@/lib/twitch-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = z.object({ key: z.string() }).safeParse(await request.json().catch(() => null));
  if (!body.success || !validOverlayKey(body.data.key)) return NextResponse.json({ error: "Invalid overlay key." }, { status: 400 });
  const key = body.data.key;
  const config = getTwitchConfig();
  const session = await readTwitchSession(key);
  if (config && session) {
    await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, token: session.accessToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearTwitchSession(key);
  return NextResponse.json({ connected: false }, { headers: { "Cache-Control": "no-store" } });
}
