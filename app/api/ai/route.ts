import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getOptionalUserId } from "@/lib/auth/dal";
import { listItems } from "@/lib/db/items";
import { generateJson, geminiConfigured } from "@/lib/ai/gemini";
import {
  AI_RESPONSE_GEMINI_SCHEMA,
  aiResponseSchema,
  repairAiResponse,
  type AiResponse,
} from "@/lib/ai/operations";
import { buildSystemInstruction } from "@/lib/ai/prompt";
import {
  applyAiResponse,
  inferOneOffCreateFromMessage,
  inferWeeklyCreateFromMessage,
} from "@/lib/ai/apply";
import { rescheduleOverdueTasks } from "@/lib/ai/rescheduleOverdue";
import {
  applyUndoSnapshot,
  isRedoRequest,
  isUndoRequest,
  type UndoSnapshot,
} from "@/lib/ai/undo";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { ISO_DATE } from "@/lib/calendar/time";

/** One repair pass: feed the apply/parse error + prior JSON back to Gemini. */
function buildRetryPrompt(
  userText: string,
  previous: unknown,
  error: string
): string {
  return [
    `Student request:\n${userText}`,
    `Your previous JSON (rejected):\n${JSON.stringify(previous)}`,
    `Server error / rejection:\n${error}`,
    `Fix the JSON to resolve that error. If the student already named a fixed item and asked to move it, set "explicit": true. If you still need information, return only a clarification — do not repeat the same failing operations.`,
  ].join("\n\n");
}

async function generateAndParseAiResponse(opts: {
  systemInstruction: string;
  contents: string;
}): Promise<
  | { ok: true; data: AiResponse; raw: unknown }
  | {
      ok: false;
      raw: unknown;
      repaired: unknown;
      parseError: unknown;
    }
> {
  const raw = await generateJson({
    systemInstruction: opts.systemInstruction,
    contents: opts.contents,
    responseSchema: AI_RESPONSE_GEMINI_SCHEMA,
  });
  const repaired = repairAiResponse(raw);
  const parsed = aiResponseSchema.safeParse(repaired);
  if (!parsed.success) {
    return {
      ok: false,
      raw,
      repaired,
      parseError: parsed.error.issues.slice(0, 5),
    };
  }
  return { ok: true, data: parsed.data, raw };
}

export async function POST(request: Request) {
  let body: {
    text?: string;
    context?: { weekDates?: string[]; tz?: string; nowIso?: string };
    undo?: UndoSnapshot;
    redo?: UndoSnapshot;
    rescheduleOverdue?: { itemId: string; date: string }[];
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

  const tz = body.context?.tz ?? DEFAULT_TIMEZONE;
  const nowIso =
    body.context?.nowIso ??
    DateTime.now().setZone(tz).toISO() ??
    new Date().toISOString();
  const todayIso = DateTime.fromISO(nowIso, { zone: tz }).toFormat(ISO_DATE);
  const weekDates =
    body.context?.weekDates && body.context.weekDates.length === 7
      ? body.context.weekDates
      : [todayIso];

  // One-click overdue reschedule — deterministic free-slot placement, no Gemini.
  if (body.rescheduleOverdue && body.rescheduleOverdue.length > 0) {
    const result = await rescheduleOverdueTasks(userId, body.rescheduleOverdue, {
      tz,
      todayIso,
      weekDates,
      nowIso,
    });
    return NextResponse.json(
      {
        ...result,
        prompt: text || "reschedule overdue",
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

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "Say what you'd like to change." },
      { status: 400 }
    );
  }

  const applyCtx = {
    tz,
    todayIso,
    weekDates,
    nowIso,
    userText: text,
  };

  // Fast path: simple weekly / one-off creates — skip Gemini entirely.
  // Weekly first so "add tutoring to sundays…" is not treated as a one-off.
  const localCreate =
    inferWeeklyCreateFromMessage(text) ??
    inferOneOffCreateFromMessage(text, applyCtx);
  if (localCreate) {
    const result = await applyAiResponse(
      userId,
      { summary: `Added ${localCreate.title ?? "that item"}.`, operations: [localCreate] },
      applyCtx
    );
    return NextResponse.json(
      {
        ...result,
        prompt: text,
        usedFallback: true,
        model: { operations: [localCreate] },
      },
      { status: result.ok ? 200 : 422 }
    );
  }

  if (!geminiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI is not configured. Set GEMINI_API_KEY in .env.local." },
      { status: 400 }
    );
  }

  try {
    const items = await listItems(userId);
    const systemInstruction = buildSystemInstruction({
      tz,
      nowIso,
      weekDates,
      items,
    });

    let generated = await generateAndParseAiResponse({
      systemInstruction,
      contents: text,
    });

    let usedModelRetry = false;

    if (!generated.ok) {
      // One repair attempt with the parse error fed back to the model.
      usedModelRetry = true;
      try {
        generated = await generateAndParseAiResponse({
          systemInstruction,
          contents: buildRetryPrompt(
            text,
            generated.repaired ?? generated.raw,
            `Response failed validation: ${JSON.stringify(generated.parseError)}`
          ),
        });
      } catch {
        // Fall through to clarification from the first parse failure.
      }
    }

    if (!generated.ok) {
      return NextResponse.json({
        ok: true,
        clarification:
          "I understood the idea but the change came through incomplete — try once more, or be a bit more specific (e.g. “make assembly start at 12:00 every week”).",
        prompt: text,
        model: generated.raw,
        repaired: generated.repaired,
        parseError: generated.parseError,
      });
    }

    const model = generated.data;
    let result = await applyAiResponse(userId, model, applyCtx);

    // Apply rejected the ops — one Gemini retry with the error + prior JSON
    // (skipped if we already used the single repair slot on a parse failure).
    if (!result.ok && result.error && !usedModelRetry) {
      try {
        const retry = await generateAndParseAiResponse({
          systemInstruction,
          contents: buildRetryPrompt(text, model, result.error),
        });
        if (retry.ok) {
          const retried = await applyAiResponse(userId, retry.data, applyCtx);
          return NextResponse.json(
            {
              ...retried,
              prompt: text,
              model: retry.data,
              priorError: result.error,
              retried: true,
            },
            { status: retried.ok ? 200 : 422 }
          );
        }
      } catch {
        // Keep the original apply failure for the client.
      }
    }

    return NextResponse.json(
      {
        ...result,
        prompt: text,
        model,
      },
      { status: result.ok ? 200 : 422 }
    );
  } catch (err) {
    const timedOut =
      err instanceof Error && err.message.includes("took too long");
    // Last resort: if Gemini hung, still try a simple local create.
    if (timedOut) {
      const fallback =
        inferWeeklyCreateFromMessage(text) ??
        inferOneOffCreateFromMessage(text, applyCtx);
      if (fallback) {
        const result = await applyAiResponse(
          userId,
          {
            summary: `Added ${fallback.title ?? "that item"}.`,
            operations: [fallback],
          },
          applyCtx
        );
        return NextResponse.json(
          {
            ...result,
            prompt: text,
            usedFallback: true,
            model: { operations: [fallback] },
          },
          { status: result.ok ? 200 : 422 }
        );
      }
    }
    const message =
      err instanceof Error && err.message.includes("GEMINI_API_KEY")
        ? err.message
        : timedOut
          ? err.message
          : "The planner had trouble with that request. Please try again.";
    return NextResponse.json(
      { ok: false, error: message, prompt: text },
      { status: 500 }
    );
  }
}
