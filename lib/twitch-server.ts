import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { deleteTwitchToken, listStoredBloubRecords, readTwitchToken, validOverlayKey, writeTwitchToken } from "@/lib/bloub-store";

const CHAT_SCOPES = ["user:read:chat"] as const;
const CHAT_WRITE_SCOPES = ["user:write:chat"] as const;
const POLL_SCOPES = ["channel:manage:polls"] as const;
const REQUIRED_SCOPES = [...CHAT_SCOPES, ...CHAT_WRITE_SCOPES, ...POLL_SCOPES] as const;
const TwitchSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  userId: z.string(),
  login: z.string(),
  scopes: z.array(z.string()),
});

export type TwitchSession = z.infer<typeof TwitchSessionSchema>;

export function getTwitchConfig() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;
  const sessionSecret = process.env.TWITCH_SESSION_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !sessionSecret || sessionSecret.length < 32) return null;
  return { clientId, clientSecret, redirectUri, sessionSecret };
}

export function getGroqConfig() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: process.env.GROQ_MODEL || "openai/gpt-oss-20b" };
}

export function getTypeSafeConfig() {
  const apiKey = process.env.TYPESAFE_API_KEY;
  return apiKey ? { apiKey } : null;
}

export function getTwitchExtensionConfigIssues() {
  const clientId = process.env.TWITCH_EXTENSION_ID?.trim();
  const secret = process.env.TWITCH_EXTENSION_SECRET?.trim();
  const version = process.env.TWITCH_EXTENSION_VERSION?.trim();
  const ownerId = process.env.TWITCH_EXTENSION_OWNER_ID?.trim();
  const issues: string[] = [];

  if (!clientId) issues.push("TWITCH_EXTENSION_ID is missing.");
  if (!secret) issues.push("TWITCH_EXTENSION_SECRET is missing.");
  else if (Buffer.from(secret, "base64").length < 32) issues.push("TWITCH_EXTENSION_SECRET must be the Base64 shared secret from Twitch Extension Settings.");
  if (!version) issues.push("TWITCH_EXTENSION_VERSION is missing; use the version shown in Twitch Extension Manager.");
  if (!ownerId) issues.push("TWITCH_EXTENSION_OWNER_ID is missing.");
  else if (!/^\d+$/.test(ownerId)) issues.push("TWITCH_EXTENSION_OWNER_ID must be the numeric Twitch user ID of the account that owns the Extension, not its login name.");

  return issues;
}

export function getTwitchExtensionConfig() {
  if (getTwitchExtensionConfigIssues().length) return null;
  const clientId = process.env.TWITCH_EXTENSION_ID!.trim();
  const secret = process.env.TWITCH_EXTENSION_SECRET!.trim();
  const version = process.env.TWITCH_EXTENSION_VERSION!.trim();
  const ownerId = process.env.TWITCH_EXTENSION_OWNER_ID!.trim();
  const sharedSecret = Buffer.from(secret, "base64");
  return { clientId, secret, sharedSecret, version, ownerId };
}

function encryptSession(session: TwitchSession, secret: string) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptSession(value: string, secret: string): TwitchSession | null {
  try {
    const [ivPart, tagPart, encryptedPart] = value.split(".");
    if (!ivPart || !tagPart || !encryptedPart) return null;
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
    const result = TwitchSessionSchema.safeParse(JSON.parse(plain));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function readTwitchSession(key: string) {
  const config = getTwitchConfig();
  if (!config || !validOverlayKey(key)) return null;
  const value = await readTwitchToken(key);
  return value ? decryptSession(value, config.sessionSecret) : null;
}

export async function listConnectedTwitchSessions() {
  const config = getTwitchConfig();
  if (!config) return [];
  const records = await listStoredBloubRecords();
  return records.flatMap((record) => {
    if (!validOverlayKey(record.key) || !record.twitchToken || !record.session) return [];
    const twitchSession = decryptSession(record.twitchToken, config.sessionSecret);
    if (!twitchSession) return [];
    return [{ key: record.key, appSession: record.session, twitchSession }];
  });
}

export async function writeTwitchSession(key: string, session: TwitchSession) {
  const config = getTwitchConfig();
  if (!config || !validOverlayKey(key)) throw new Error("Twitch server settings are missing.");
  await writeTwitchToken(key, encryptSession(session, config.sessionSecret));
}

export async function clearTwitchSession(key: string) {
  if (validOverlayKey(key)) await deleteTwitchToken(key);
}

async function refreshTwitchSession(overlayKey: string, session: TwitchSession): Promise<TwitchSession> {
  const config = getTwitchConfig();
  if (!config) throw new Error("Twitch server settings are missing.");
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Twitch login expired. Reconnect your account.");
  const result = z.object({ access_token: z.string(), refresh_token: z.string(), scope: z.array(z.string()) }).parse(await response.json());
  const refreshed = { ...session, accessToken: result.access_token, refreshToken: result.refresh_token, scopes: result.scope };
  await writeTwitchSession(overlayKey, refreshed);
  return refreshed;
}

export async function twitchApiFetch(overlayKey: string, path: string, init: RequestInit = {}) {
  const config = getTwitchConfig();
  let session = await readTwitchSession(overlayKey);
  if (!config || !session) throw new Error("Connect Twitch to continue.");

  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Client-Id", config.clientId);
    return fetch(`https://api.twitch.tv/helix${path}`, { ...init, headers, cache: "no-store" });
  };

  let response = await send(session.accessToken);
  if (response.status === 401) {
    session = await refreshTwitchSession(overlayKey, session);
    response = await send(session.accessToken);
  }
  return { response, session };
}

export { CHAT_SCOPES, CHAT_WRITE_SCOPES, POLL_SCOPES, REQUIRED_SCOPES };
