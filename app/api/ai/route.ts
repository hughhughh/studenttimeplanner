import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getOptionalUserId } from "@/lib/auth/dal";
import { listItems } from "@/lib/db/items";
import { generateJson, geminiConfigured } from "@/lib/ai/gemini";
import {
  AI_RESPONSE_GEMINI_SCHEMA,
  aiResponseSchema,
} from "@/lib/ai/operations";
import { buildSystemInstruction } from "@/lib/ai/prompt";
import { applyAiResponse } from "@/lib/ai/apply";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { ISO_DATE } from "@/lib/calendar/time";

export async function POST(request: Request) {
  if (!geminiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI is not configured. Set GEMINI_API_KEY in .env.local." },
      { status: 400 }
    );
  }

  let body: { text?: string; context?: { weekDates?: string[]; tz?: string; nowIso?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Say what you'd like to change." }, { status: 400 });
  }

  const tz = body.context?.tz ?? DEFAULT_TIMEZONE;
  const nowIso = body.context?.nowIso ?? DateTime.now().setZone(tz).toISO() ?? new Date().toISOString();
  const todayIso = DateTime.fromISO(nowIso, { zone: tz }).toFormat(ISO_DATE);
  const weekDates =
    body.context?.weekDates && body.context.weekDates.length === 7
      ? body.context.weekDates
      : [todayIso];

  const userId = await getOptionalUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }

  try {
    const items = await listItems(userId);

    const raw = await generateJson({
      systemInstruction: buildSystemInstruction({ tz, nowIso, weekDates, items }),
      contents: text,
      responseSchema: AI_RESPONSE_GEMINI_SCHEMA,
    });

    const parsed = aiResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({
        ok: true,
        clarification: "Sorry, I couldn't understand that. Could you rephrase?",
      });
    }

    const result = await applyAiResponse(userId, parsed.data, {
      tz,
      todayIso,
      weekDates,
      userText: text,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("GEMINI_API_KEY")
        ? err.message
        : "The planner had trouble with that request. Please try again.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
