import { NextResponse } from "next/server";
import { z } from "zod";
import { readBloubSession, validOverlayKey, writeBloubSession } from "@/lib/bloub-store";
import { CHAT_EXPRESSIONS } from "@/lib/chat-types";
import { SEQUENCE } from "@/lib/bloub/states";
import { SHAPES } from "@/lib/bloub/skins";
import type { ShapeId } from "@/lib/bloub/skins";
import type { StateId } from "@/lib/bloub/states";

export const runtime = "nodejs";

const MascotSessionSchema = z.object({
  overlayKey: z.string().regex(/^[A-Za-z0-9_-]{32,80}$/),
  name: z.string().trim().max(24),
  config: z.object({
    shape: z.string().refine((value) => SHAPES.some((shape) => shape.id === value)).transform((value) => value as ShapeId),
    color: z.string().regex(/^#[\da-f]{6}$/i),
    expression: z.enum(CHAT_EXPRESSIONS),
    state: z.string().refine((value) => SEQUENCE.includes(value as (typeof SEQUENCE)[number])).transform((value) => value as StateId),
  }).strict(),
  twitchChannel: z.union([z.literal(""), z.string().regex(/^[a-zA-Z0-9_]{1,25}$/)]),
  obsConfigured: z.boolean(),
  running: z.boolean(),
  chatbotEnabled: z.boolean(),
}).strict();

export async function GET(request: Request) {
  const key = request.headers.get("x-bloub-key");
  if (!validOverlayKey(key)) return NextResponse.json({ error: "Invalid overlay key." }, { status: 400 });
  const session = await readBloubSession(key);
  if (!session) return NextResponse.json({ error: "Overlay session not found." }, { status: 404 });
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const body = z.object({ key: z.string(), session: MascotSessionSchema }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success || !validOverlayKey(body.data.key) || body.data.session.overlayKey !== body.data.key) {
    return NextResponse.json({ error: "Invalid overlay session." }, { status: 400 });
  }
  await writeBloubSession(body.data.key, body.data.session);
  return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}
