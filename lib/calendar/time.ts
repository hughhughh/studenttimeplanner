import { DateTime } from "luxon";
import { DEFAULT_TIMEZONE } from "@/lib/config";

/**
 * Timezone-aware date helpers. Everything in Student Time Planner is reasoned about in the
 * user's timezone (default Australia/Sydney) so "tonight", "today", and the
 * now-indicator all line up with what the student actually sees.
 */

export const ISO_DATE = "yyyy-MM-dd";
export const TIME_OF_DAY = "HH:mm";

export function now(tz: string = DEFAULT_TIMEZONE): DateTime {
  return DateTime.now().setZone(tz);
}

/** Monday 00:00 of the week containing `ref`. */
export function startOfWeek(ref: DateTime): DateTime {
  return ref.startOf("week");
}

/** Sunday 23:59:59.999 of the week containing `ref`. */
export function endOfWeek(ref: DateTime): DateTime {
  return ref.endOf("week");
}

/** The seven Monday-Sunday dates ("yyyy-MM-dd") for the week containing `ref`. */
export function weekDates(ref: DateTime): string[] {
  const start = startOfWeek(ref);
  return Array.from({ length: 7 }, (_, i) =>
    start.plus({ days: i }).toFormat(ISO_DATE)
  );
}

/** Parse "yyyy-MM-dd" + "HH:mm" into a zoned DateTime. */
export function dateTimeFrom(
  date: string,
  time: string,
  tz: string = DEFAULT_TIMEZONE
): DateTime {
  return DateTime.fromFormat(`${date} ${time}`, `${ISO_DATE} ${TIME_OF_DAY}`, {
    zone: tz,
  });
}

/** "yyyy-MM-dd" of an ISO datetime, in the given zone. */
export function dateOfISO(iso: string, tz: string = DEFAULT_TIMEZONE): string {
  return DateTime.fromISO(iso, { zone: tz }).toFormat(ISO_DATE);
}

/** Minutes since midnight for an ISO datetime, in the given zone. */
export function minutesIntoDay(
  iso: string,
  tz: string = DEFAULT_TIMEZONE
): number {
  const dt = DateTime.fromISO(iso, { zone: tz });
  return dt.hour * 60 + dt.minute;
}

export function isValidTimeOfDay(time: string): boolean {
  return DateTime.fromFormat(time, TIME_OF_DAY).isValid;
}

export function isValidDate(date: string): boolean {
  return DateTime.fromFormat(date, ISO_DATE).isValid;
}

/**
 * Coerce model / user time strings into strict "HH:mm".
 * Accepts 24h and common 12h forms; returns null if unparseable.
 */
export function normalizeTimeOfDay(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const as24 = DateTime.fromFormat(trimmed, TIME_OF_DAY);
  if (as24.isValid) return as24.toFormat(TIME_OF_DAY);

  const withSeconds = DateTime.fromFormat(trimmed, "HH:mm:ss");
  if (withSeconds.isValid) return withSeconds.toFormat(TIME_OF_DAY);

  const cleaned = trimmed
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .toUpperCase();

  for (const fmt of ["h:mm a", "h a", "ha", "h:mma", "H:mm"] as const) {
    const dt = DateTime.fromFormat(cleaned, fmt);
    if (dt.isValid) return dt.toFormat(TIME_OF_DAY);
  }

  return null;
}

/** Minutes since midnight, or null when the ISO string is not a real datetime. */
export function minutesIntoDayOrNull(
  iso: string,
  tz: string = DEFAULT_TIMEZONE
): number | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: tz });
  if (!dt.isValid) return null;
  return dt.hour * 60 + dt.minute;
}

const TIME_TOKEN =
  String.raw`(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)`;

/**
 * Pull an explicit start/end range from natural language when present.
 * Handles "from 11:55am to 12:50pm", "5 to 6:30pm", "11:55–12:50".
 * When only one side has am/pm, that meridiem is applied to the other.
 */
export function extractTimeRangeFromMessage(message: string): {
  timeStart?: string;
  timeEnd?: string;
} {
  const re = new RegExp(
    String.raw`(?:from\s+)?${TIME_TOKEN}\s*(?:to|-|–|—|till|until)\s*${TIME_TOKEN}`,
    "i"
  );
  const match = message.match(re);
  if (!match) return {};

  let startRaw = match[1].trim();
  let endRaw = match[2].trim();
  const startMeridiem = startRaw.match(/([ap])\.?m\.?/i)?.[0];
  const endMeridiem = endRaw.match(/([ap])\.?m\.?/i)?.[0];
  if (endMeridiem && !startMeridiem) {
    startRaw = `${startRaw}${endMeridiem}`;
  } else if (startMeridiem && !endMeridiem) {
    endRaw = `${endRaw}${startMeridiem}`;
  }

  const timeStart = normalizeTimeOfDay(startRaw) ?? undefined;
  const timeEnd = normalizeTimeOfDay(endRaw) ?? undefined;
  if (timeStart && timeEnd && timeStart >= timeEnd) return {};
  return { timeStart, timeEnd };
}

/** Default end = start + 1 hour, same calendar day. */
export function defaultEndFromStart(timeStart: string): string {
  return DateTime.fromFormat(timeStart, TIME_OF_DAY)
    .plus({ hours: 1 })
    .toFormat(TIME_OF_DAY);
}
