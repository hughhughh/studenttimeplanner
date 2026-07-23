import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getOptionalUserId } from "@/lib/auth/dal";
import { listItems } from "@/lib/db/items";
import { generateJson, geminiConfigured } from "@/lib/ai/gemini";
import {
  AI_RESPONSE_GEMINI_SCHEMA,
  aiResponseSchema,
  repairAiResponse,
} from "@/lib/ai/operations";
import { buildSystemInstruction } from "@/lib/ai/prompt";
import { applyAiResponse } from "@/lib/ai/apply";
import {
  applyUndoSnapshot,
  isRedoRequest,
  isUndoRequest,
  type UndoSnapshot,
} from "@/lib/ai/undo";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { ISO_DATE } from "@/lib/calendar/time";

export async function POST(request: Request) {
  let body: {
    text?: string;
    context?: { weekDates?: string[]; tz?: string; nowIso?: string };
    undo?: UndoSnapshot;
    redo?: UndoSnapshot;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const userId = await getOptionalUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }

  // Session undo / redo — no Gemini. Client sends the snapshot it stored.
  if (body.redo) {
    if (!body.redo.steps?.length) {
      return NextResponse.json({
        ok: true,
        clarification:
          "There's nothing to redo in this session. Redo only works right after an undo, before you make a new change.",
        prompt: text || "redo",
      });
    }
    const result = await applyUndoSnapshot(userId, body.redo, { mode: "redo" });
    return NextResponse.json(
      {
        ...result,
        prompt: text || "redo",
        redid: body.redo.label,
        undo: result.inverse,
      },
      { status: result.ok ? 200 : 422 }
    );
  }

  if (body.undo) {
    if (!body.undo.steps?.length) {
      return NextResponse.json({
        ok: true,
        clarification:
          "There's nothing to undo in this session. Undo only covers AI changes since your last refresh.",
        prompt: text || "undo",
      });
    }
    const result = await applyUndoSnapshot(userId, body.undo, { mode: "undo" });
    return NextResponse.json(
      {
        ...result,
        prompt: text || "undo",
        undid: body.undo.label,
        // Client parks this on the redo stack.
        redo: result.inverse,
      },
      { status: result.ok ? 200 : 422 }
    );
  }

  if (text && isRedoRequest(text)) {
    return NextResponse.json({
      ok: true,
      clarification:
        "There's nothing to redo in this session. Redo only works right after an undo, before you make a new change.",
      prompt: text,
    });
  }

  if (text && isUndoRequest(text)) {
    return NextResponse.json({
      ok: true,
      clarification:
        "There's nothing to undo in this session. Undo only covers AI changes since your last refresh.",
      prompt: text,
    });
  }

  if (!geminiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI is not configured. Set GEMINI_API_KEY in .env.local." },
      { status: 400 }
    );
  }

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

  try {
    const items = await listItems(userId);

    const raw = await generateJson({
      systemInstruction: buildSystemInstruction({ tz, nowIso, weekDates, items }),
      contents: text,
      responseSchema: AI_RESPONSE_GEMINI_SCHEMA,
    });

    const repaired = repairAiResponse(raw);
    const parsed = aiResponseSchema.safeParse(repaired);
    if (!parsed.success) {
      return NextResponse.json({
        ok: true,
        clarification:
          "I understood the idea but the change came through incomplete — try once more, or be a bit more specific (e.g. “make assembly start at 12:00 every week”).",
        prompt: text,
        model: raw,
        repaired,
        parseError: parsed.error.issues.slice(0, 5),
      });
    }

    const result = await applyAiResponse(userId, parsed.data, {
      tz,
      todayIso,
      weekDates,
      userText: text,
    });
    return NextResponse.json(
      {
        ...result,
        prompt: text,
        model: parsed.data,
      },
      { status: result.ok ? 200 : 422 }
    );
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("GEMINI_API_KEY")
        ? err.message
        : err instanceof Error && err.message.includes("took too long")
          ? err.message
          : "The planner had trouble with that request. Please try again.";
    return NextResponse.json(
      { ok: false, error: message, prompt: text },
      { status: 500 }
    );
  }
}
