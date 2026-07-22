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
