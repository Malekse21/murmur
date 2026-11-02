import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readBloubSession, validOverlayKey } from "@/lib/bloub-store";
import { getTwitchConfig, REQUIRED_SCOPES, writeTwitchSession } from "@/lib/twitch-server";

export const runtime = "nodejs";

const OAuthTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  scope: z.array(z.string()),
});
const UserListSchema = z.object({ data: z.array(z.object({ id: z.string(), login: z.string() })).min(1) });

export async function GET(request: Request) {
  const config = getTwitchConfig();
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("bloub_twitch_state")?.value;
  const key = cookieStore.get("bloub_twitch_key")?.value;
  const next = cookieStore.get("bloub_twitch_next")?.value === "/dashboard" ? "/dashboard" : "/onboarding?step=2";
  for (const name of ["bloub_twitch_state", "bloub_twitch_key", "bloub_twitch_next"]) cookieStore.set(name, "", { path: "/", maxAge: 0 });

  const redirect = (result: string) => {
    const destination = new URL(next, requestUrl.origin);
    destination.searchParams.set("twitch", result);
    return NextResponse.redirect(destination);
  };
  if (!config) return redirect("missing-config");
  if (requestUrl.searchParams.has("error")) return redirect("denied");
  const code = requestUrl.searchParams.get("code");
  if (!validOverlayKey(key) || !code || !expectedState || requestUrl.searchParams.get("state") !== expectedState) return redirect("invalid-state");
  const appSession = await readBloubSession(key);
  if (!appSession?.twitchChannel) return redirect("session-expired");

  try {
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return redirect("token-error");
    const tokens = OAuthTokenSchema.parse(await tokenResponse.json());
    if (!REQUIRED_SCOPES.every((scope) => tokens.scope.includes(scope))) return redirect("missing-scopes");

    const userResponse = await fetch("https://api.twitch.tv/helix/users", {
      headers: { "Client-Id": config.clientId, Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) return redirect("account-error");
    const user = UserListSchema.parse(await userResponse.json()).data[0];
    if (user.login.toLowerCase() !== appSession.twitchChannel.toLowerCase()) {
      await fetch("https://id.twitch.tv/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: config.clientId, token: tokens.access_token }),
        cache: "no-store",
      }).catch(() => undefined);
      return redirect("account-mismatch");
    }

    await writeTwitchSession(key, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: user.id,
      login: user.login,
      scopes: tokens.scope,
    });
    return redirect("connected");
  } catch {
    return redirect("connection-error");
  }
}
