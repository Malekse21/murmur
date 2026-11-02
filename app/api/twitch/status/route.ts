import { NextResponse } from "next/server";
import { validOverlayKey } from "@/lib/bloub-store";
import { getGroqConfig, getTwitchConfig, getTwitchExtensionConfig, getTwitchExtensionConfigIssues, getTypeSafeConfig, readTwitchSession } from "@/lib/twitch-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const key = request.headers.get("x-bloub-key");
  const configured = Boolean(getTwitchConfig());
  const groqConfigured = Boolean(getGroqConfig());
  const jevConfigured = Boolean(getTypeSafeConfig());
  const extensionConfigured = Boolean(getTwitchExtensionConfig());
  const extensionConfigIssues = getTwitchExtensionConfigIssues();
  if (!validOverlayKey(key)) return NextResponse.json({ configured, groqConfigured, jevConfigured, extensionConfigured, extensionConfigIssues, connected: false, login: null, userId: null }, { status: 400 });
  const session = configured ? await readTwitchSession(key) : null;
  return NextResponse.json({
    configured,
    groqConfigured,
    jevConfigured,
    extensionConfigured,
    extensionConfigIssues,
    connected: Boolean(session),
    login: session?.login ?? null,
    userId: session?.userId ?? null,
    scopes: session?.scopes ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
