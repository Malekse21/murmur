import { listConnectedTwitchSessions } from "@/lib/twitch-server";
import { extensionCorsHeaders, verifyTwitchExtensionToken } from "@/lib/twitch-extension";

export const runtime = "nodejs";

function reply(body: unknown, status: number, origin: string | null) {
  const headers = extensionCorsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request.headers.get("origin")) });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const claims = verifyTwitchExtensionToken(request.headers.get("authorization"));
  if (!claims) return reply({ error: "Invalid Twitch Extension authorization." }, 401, origin);

  try {
    const account = (await listConnectedTwitchSessions()).find((entry) => entry.twitchSession.userId === claims.channel_id);
    if (!account) return reply({ ready: false, channelId: claims.channel_id }, 200, origin);
    return reply({
      ready: true,
      channelId: claims.channel_id,
      name: account.appSession.name,
      config: account.appSession.config,
      running: account.appSession.running,
      chatbotEnabled: account.appSession.chatbotEnabled,
    }, 200, origin);
  } catch {
    return reply({ error: "MurMur could not load this channel." }, 500, origin);
  }
}
