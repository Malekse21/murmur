import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getTwitchExtensionConfig } from "@/lib/twitch-server";

const ExtensionClaimsSchema = z.object({
  channel_id: z.string().min(1),
  exp: z.number(),
  role: z.enum(["broadcaster", "moderator", "viewer", "external"]),
  user_id: z.string().optional(),
  client_id: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough();

export type TwitchExtensionClaims = z.infer<typeof ExtensionClaimsSchema>;

function decodePart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

export function verifyTwitchExtensionToken(authorization: string | null) {
  const config = getTwitchExtensionConfig();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!config || !match) return null;

  const [headerPart, payloadPart, signaturePart, extra] = match[1].split(".");
  if (!headerPart || !payloadPart || !signaturePart || extra) return null;

  try {
    const header = decodePart<{ alg?: string }>(headerPart);
    if (header.alg !== "HS256") return null;
    const unsigned = `${headerPart}.${payloadPart}`;
    const expected = createHmac("sha256", config.sharedSecret).update(unsigned).digest();
    const received = Buffer.from(signaturePart, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const claims = ExtensionClaimsSchema.parse(decodePart<unknown>(payloadPart));
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (claims.role === "external") return null;
    if (claims.client_id && claims.client_id !== config.clientId) return null;
    if (claims.aud && !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(config.clientId)) return null;
    return claims;
  } catch {
    return null;
  }
}

function signExtensionToken(channelId: string, permission: "chat" | "broadcast") {
  const config = getTwitchExtensionConfig();
  if (!config) throw new Error("Twitch Extension credentials are not configured.");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const claims = {
    exp: Math.floor(Date.now() / 1000) + 60,
    user_id: config.ownerId,
    role: "external",
    channel_id: channelId,
    ...(permission === "broadcast" ? { pubsub_perms: { send: ["broadcast"] } } : {}),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", config.sharedSecret).update(unsigned).digest("base64url");
  return { token: `${unsigned}.${signature}`, config };
}

export async function sendExtensionChatMessage(channelId: string, text: string) {
  const { token, config } = signExtensionToken(channelId, "chat");
  const response = await fetch(`https://api.twitch.tv/helix/extensions/chat?broadcaster_id=${encodeURIComponent(channelId)}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Client-Id": config.clientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text.slice(0, 280), extension_id: config.clientId, extension_version: config.version }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twitch Extension chat failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}

export async function publishMascotExpression(channelId: string, expression: string, messageId: string) {
  const { token, config } = signExtensionToken(channelId, "broadcast");
  const response = await fetch("https://api.twitch.tv/helix/extensions/pubsub", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Client-Id": config.clientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: ["broadcast"],
      broadcaster_id: channelId,
      message: JSON.stringify({ type: "mascot-expression", expression, messageId, sentAt: Date.now() }),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twitch Extension PubSub failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}

export function extensionCorsHeaders(origin: string | null) {
  const config = getTwitchExtensionConfig();
  const allowed = new Set([
    config ? `https://${config.clientId}.ext-twitch.tv` : "",
    ...(process.env.TWITCH_EXTENSION_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()),
  ].filter(Boolean));
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  if (origin && allowed.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
