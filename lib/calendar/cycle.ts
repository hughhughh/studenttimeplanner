import { DateTime } from "luxon";
import type { Recurrence } from "@/lib/types";
import { ISO_DATE } from "@/lib/calendar/time";

/** Which half of a two-week school cycle a block belongs to. */
export type CycleWeek = "A" | "B";

/**
 * Many schools label timetable days 1–10:
 * Day 1 = Mon Week A … Day 5 = Fri Week A, Day 6 = Mon Week B … Day 10 = Fri Week B.
 */
export function cycleDayToWeekdayAndCycle(cycleDay: number): {
  weekday: number;
  cycleWeek: CycleWeek;
} {
  if (!Number.isInteger(cycleDay) || cycleDay < 1 || cycleDay > 10) {
    throw new Error(`cycleDay must be 1–10, got ${cycleDay}`);
  }
  const idx = cycleDay - 1;
  return {
    weekday: (idx % 5) + 1,
    cycleWeek: idx < 5 ? "A" : "B",
  };
}

/** Build a fortnightly recurrence anchored to the visible calendar week. */
export function recurrenceFromCycle(opts: {
  cycleWeek: CycleWeek;
  weekday: number;
  timeStart: string;
  timeEnd: string;
  anchorMonday: string;
  currentCycleWeek: CycleWeek;
}): Recurrence {
  const anchor = DateTime.fromFormat(opts.anchorMonday, ISO_DATE);
  const weekAMonday =
    opts.currentCycleWeek === "A" ? anchor : anchor.minus({ weeks: 1 });
  const weekBMonday = weekAMonday.plus({ weeks: 1 });
  const startDate = (opts.cycleWeek === "A" ? weekAMonday : weekBMonday).toFormat(
    ISO_DATE
  );
  return {
    freq: "weekly",
    byWeekday: [opts.weekday],
    interval: 2,
    timeStart: opts.timeStart,
    timeEnd: opts.timeEnd,
    startDate,
  };
}
