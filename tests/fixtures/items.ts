import { DateTime } from "luxon";
import type { Item } from "@/lib/types";
import { dateTimeFrom, ISO_DATE } from "@/lib/calendar/time";

/**
 * Premade calendar fixtures for automated tests.
 * Frozen around the week of Monday 20 July 2026 (Australia/Sydney).
 */

export const TZ = "Australia/Sydney";

/** Wednesday 22 July 2026, 12:00 Sydney — "now" for deterministic status. */
export const NOW = DateTime.fromObject(
  { year: 2026, month: 7, day: 22, hour: 12, minute: 0 },
  { zone: TZ }
);

export const WEEK_DATES = [
  "2026-07-20", // Mon
  "2026-07-21", // Tue
  "2026-07-22", // Wed
  "2026-07-23", // Thu
  "2026-07-24", // Fri
  "2026-07-25", // Sat
  "2026-07-26", // Sun
];

const stamp = "2026-07-01T00:00:00.000+10:00";

function base(
  partial: Omit<Item, "createdAt" | "updatedAt" | "userId" | "tz"> &
    Partial<Pick<Item, "userId" | "tz">>
): Item {
  return {
    userId: "test-user",
    tz: TZ,
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  };
}

function at(date: string, time: string): string {
  return dateTimeFrom(date, time, TZ).toISO() ?? "";
}

/** Fixed weekday school block Mon–Fri 08:30–15:00. */
export const schoolWeekdays: Item = base({
  id: "school-1",
  type: "activity",
  title: "School",
  color: "#3B82F6",
  movable: false,
  recurrence: {
    freq: "weekly",
    byWeekday: [1, 2, 3, 4, 5],
    timeStart: "08:30",
    timeEnd: "15:00",
    startDate: "2026-07-01",
  },
});

/** Same school series with Wednesday skipped. */
export const schoolWithWednesdayException: Item = {
  ...schoolWeekdays,
  id: "school-skip-wed",
  exceptions: ["2026-07-22"],
};

/** Recurring revision with a title override on Thursday. */
export const revisionWithOverride: Item = base({
  id: "revision-1",
  type: "task",
  title: "Revision",
  color: "#8B5CF6",
  movable: true,
  recurrence: {
    freq: "weekly",
    byWeekday: [4],
    timeStart: "19:00",
    timeEnd: "20:00",
    startDate: "2026-07-01",
  },
  overrides: {
    "2026-07-23": { title: "Exam revision (extended)", timeEnd: "21:00" },
  },
});

/** Split-session essay: two blocks same day. */
export const splitEssay: Item = base({
  id: "essay-1",
  type: "task",
  title: "English essay",
  color: "#66AA3C",
  movable: true,
  segments: [
    { start: at("2026-07-22", "16:00"), end: at("2026-07-22", "17:00") },
    { start: at("2026-07-22", "19:00"), end: at("2026-07-22", "20:00") },
  ],
});

/** Incomplete task that ended yesterday → overdue at NOW. */
export const overdueHomework: Item = base({
  id: "hw-overdue",
  type: "task",
  title: "Math homework",
  color: "#F97316",
  movable: true,
  completed: false,
  segments: [
    { start: at("2026-07-21", "17:00"), end: at("2026-07-21", "18:00") },
  ],
});

/** Completed task in the past → done (not overdue). */
export const completedPastTask: Item = base({
  id: "hw-done",
  type: "task",
  title: "Read chapter 3",
  color: "#66AA3C",
  movable: true,
  completed: true,
  completedAt: stamp,
  segments: [
    { start: at("2026-07-21", "16:00"), end: at("2026-07-21", "16:30") },
  ],
});

/** Future single task → upcoming. */
export const upcomingTask: Item = base({
  id: "hw-upcoming",
  type: "task",
  title: "Physics worksheet",
  color: "#14B8A6",
  movable: true,
  segments: [
    { start: at("2026-07-23", "18:00"), end: at("2026-07-23", "19:00") },
  ],
});

/** Fortnightly Week A Monday sport (interval 2). */
export const weekASport: Item = base({
  id: "sport-a",
  type: "activity",
  title: "Football (Week A)",
  color: "#0EA5E9",
  movable: false,
  recurrence: {
    freq: "weekly",
    byWeekday: [1],
    interval: 2,
    timeStart: "16:00",
    timeEnd: "17:30",
    startDate: "2026-07-20", // this week's Monday = Week A anchor
  },
});

export { at, ISO_DATE };
