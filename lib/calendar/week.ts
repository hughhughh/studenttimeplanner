import { DateTime } from "luxon";
import { verifySession } from "@/lib/auth/dal";
import { listItems } from "@/lib/db/items";
import { getMongoConfig } from "@/lib/db/mongo";
import { expandWeek } from "@/lib/calendar/recurrence";
import { now, weekDates, ISO_DATE } from "@/lib/calendar/time";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import type { Occurrence } from "@/lib/types";

export interface DayMeta {
  date: string;
  weekday: number;
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
}

export interface WeekData {
  days: DayMeta[];
  occurrences: Occurrence[];
  tz: string;
  weekLabel: string;
  nowIso: string;
  dbConfigured: boolean;
  dbMessage?: string;
}

function buildDays(dates: string[], todayIso: string, tz: string): DayMeta[] {
  return dates.map((date) => {
    const dt = DateTime.fromFormat(date, ISO_DATE, { zone: tz });
    return {
      date,
      weekday: dt.weekday,
      label: dt.toFormat("ccc"),
      dayOfMonth: dt.day,
      isToday: date === todayIso,
      isPast: date < todayIso,
    };
  });
}

function buildWeekLabel(dates: string[], tz: string): string {
  const start = DateTime.fromFormat(dates[0], ISO_DATE, { zone: tz });
  const end = DateTime.fromFormat(dates[6], ISO_DATE, { zone: tz });
  const sameMonth = start.month === end.month;
  const startStr = sameMonth ? start.toFormat("d") : start.toFormat("d LLL");
  return `${startStr} – ${end.toFormat("d LLL yyyy")}`;
}

export async function getWeekData(weekOffset: number): Promise<WeekData> {
  const tz = DEFAULT_TIMEZONE;
  const nowDt = now(tz);
  const ref = nowDt.plus({ weeks: weekOffset });
  const dates = weekDates(ref);
  const todayIso = nowDt.toFormat(ISO_DATE);

  const days = buildDays(dates, todayIso, tz);
  const weekLabel = buildWeekLabel(dates, tz);
  const nowIso = nowDt.toISO() ?? new Date().toISOString();

  // Redirects unauthenticated users to /login (outside the try so the redirect
  // control-flow is not swallowed by the catch).
  const { userId } = await verifySession();

  try {
    const items = await listItems(userId);
    const occurrences = expandWeek(items, dates, nowDt);
    return { days, occurrences, tz, weekLabel, nowIso, dbConfigured: true };
  } catch (err) {
    const { uri, dbName } = getMongoConfig();
    const detail =
      err instanceof Error ? err.message : "Unknown database error";
    if (process.env.NODE_ENV === "development") {
      console.error("[Student Time Planner] MongoDB:", detail);
    }
    const dbMessage = !uri
      ? "Set MONGODB_URI in .env.local, then restart the dev server and run npm run seed."
      : `Could not connect to MongoDB (database "${dbName}"). Restart the dev server after changing .env.local. On Atlas, allow your IP under Network Access. (${detail})`;
    return {
      days,
      occurrences: [],
      tz,
      weekLabel,
      nowIso,
      dbConfigured: false,
      dbMessage,
    };
  }
}
