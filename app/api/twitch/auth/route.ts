import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readBloubSession, validOverlayKey, writeBloubSession } from "@/lib/bloub-store";
import { getTwitchConfig, REQUIRED_SCOPES } from "@/lib/twitch-server";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = getTwitchConfig();
  const requestUrl = new URL(request.url);
  if (!config) return NextResponse.redirect(new URL("/dashboard?twitch=missing-config", requestUrl));

  const key = requestUrl.searchParams.get("key");
  if (!validOverlayKey(key)) {
    return NextResponse.redirect(new URL("/onboarding?step=2&twitch=channel-required", requestUrl));
  }
  const requestedChannel = (requestUrl.searchParams.get("channel") ?? "").replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-zA-Z0-9_]{1,25}$/.test(requestedChannel)) {
    return NextResponse.redirect(new URL("/onboarding?step=2&twitch=channel-required", requestUrl));
  }
  const appSession = await readBloubSession(key);
  if (!appSession) return NextResponse.redirect(new URL("/onboarding?step=2&twitch=channel-required", requestUrl));
  if (appSession.twitchChannel !== requestedChannel) await writeBloubSession(key, { ...appSession, twitchChannel: requestedChannel });
  const next = requestUrl.searchParams.get("next") === "dashboard" ? "/dashboard" : "/onboarding?step=2";
  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("bloub_twitch_state", state, cookieOptions);
  cookieStore.set("bloub_twitch_key", key, cookieOptions);
  cookieStore.set("bloub_twitch_next", next, cookieOptions);

  const authorize = new URL("https://id.twitch.tv/oauth2/authorize");
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: REQUIRED_SCOPES.join(" "),
    state,
    force_verify: "true",
  }).toString();
  return NextResponse.redirect(authorize);
}
