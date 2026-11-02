import { NextResponse } from "next/server";
import { z } from "zod";
import { updateBloubSession, validOverlayKey } from "@/lib/bloub-store";
import { CHAT_EXPRESSIONS } from "@/lib/chat-types";

export const runtime = "nodejs";

const ExpressionUpdateSchema = z.object({ key: z.string(), expression: z.enum(CHAT_EXPRESSIONS) }).strict();

export async function POST(request: Request) {
  const body = ExpressionUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !validOverlayKey(body.data.key)) return NextResponse.json({ error: "Invalid expression update." }, { status: 400 });
  const session = await updateBloubSession(body.data.key, (current) => ({
    ...current,
    config: { ...current.config, expression: body.data.expression },
  }));
  if (!session) return NextResponse.json({ error: "Overlay session not found." }, { status: 404 });
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}
