import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getOptionalUserId } from "@/lib/auth/dal";
import { geminiConfigured } from "@/lib/ai/gemini";
import { parseTimetableImage } from "@/lib/ai/timetable";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { startOfWeek } from "@/lib/calendar/time";
import { ISO_DATE } from "@/lib/calendar/time";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(request: Request) {
  if (!geminiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI is not configured. Set GEMINI_API_KEY in .env.local." },
      { status: 400 }
    );
  }

  const userId = await getOptionalUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No image was provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "That file is not an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "That image is too large (max 8MB)." }, { status: 400 });
  }

  // Anchor recurrence to this calendar week (today), not whichever week is on screen.
  let tz = DEFAULT_TIMEZONE;
  let anchorMonday: string | undefined;
  const rawContext = form.get("context");
  if (typeof rawContext === "string") {
    try {
      const ctx = JSON.parse(rawContext) as { tz?: string; nowIso?: string };
      if (ctx.tz) tz = ctx.tz;
      const ref = ctx.nowIso
        ? DateTime.fromISO(ctx.nowIso, { zone: tz })
        : DateTime.now().setZone(tz);
      if (ref.isValid) {
        anchorMonday = startOfWeek(ref).toFormat(ISO_DATE);
      }
    } catch {
      /* ignore malformed context */
    }
  }
  if (!anchorMonday) {
    anchorMonday = startOfWeek(DateTime.now().setZone(tz)).toFormat(ISO_DATE);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await parseTimetableImage({
      base64: buffer.toString("base64"),
      mimeType: file.type,
      tz,
      startDate: anchorMonday,
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("GEMINI_API_KEY")
        ? err.message
        : "Could not read that timetable. Try a clearer photo.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
