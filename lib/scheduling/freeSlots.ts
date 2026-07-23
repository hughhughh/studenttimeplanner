import { DateTime } from "luxon";
import type { Item } from "@/lib/types";
import { expandWeek } from "@/lib/calendar/recurrence";
import {
  ISO_DATE,
  TIME_OF_DAY,
  minutesIntoDay,
} from "@/lib/calendar/time";
import { DEFAULT_WORKING_HOURS } from "@/lib/config";

export type TimeInterval = {
  date: string;
  /** Minutes since midnight. */
  startMin: number;
  endMin: number;
  title?: string;
};

export type FreeSlot = {
  date: string;
  timeStart: string;
  timeEnd: string;
};

function minToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** True when the message names a clock time (not just a duration like "for an hour"). */
export function messageSpecifiesClockTime(message: string): boolean {
  // "this time tomorrow" means use the current clock — treat as explicit.
  if (/\bthis\s+time\b/i.test(message)) return true;

  const stripped = message
    .replace(
      /\bfor\s+(?:about\s+|around\s+)?(?:an?\s+)?(?:\d+|one|two|three|half(?:\s+an?)?)\s*(?:hours?|hrs?|minutes?|mins?)\b/gi,
      " "
    )
    .replace(/\b(?:an?\s+)?(?:hour|hr)\s+(?:of|for)\b/gi, " ");

  if (
    /\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\s*(?:to|-|–|—|till|until)\s*\d{1,2}/i.test(
      stripped
    )
  ) {
    return true;
  }
  if (/\b(?:noon|midday|midnight)\b/i.test(stripped)) return true;
  if (/\b\d{1,2}:\d{2}\b/.test(stripped)) return true;
  if (/\b\d{1,2}\s*(?:[ap]\.?m\.?)\b/i.test(stripped)) return true;
  if (/\bat\s+\d{1,2}\b/i.test(stripped)) return true;
  if (/\baround\s+\d{1,2}\b/i.test(stripped)) return true;
  return false;
}

/** Duration in minutes from phrases like "for an hour" / "for 90 minutes". */
export function durationMinutesFromMessage(message: string): number | undefined {
  const hour = message.match(
    /\bfor\s+(?:about\s+|around\s+)?(?:an?\s+|one\s+)?(?:(\d+(?:\.\d+)?)\s+)?hours?\b/i
  );
  if (hour) {
    if (hour[1]) return Math.round(parseFloat(hour[1]) * 60);
    return 60;
  }
  const half = message.match(/\bfor\s+(?:about\s+|around\s+)?half\s+(?:an?\s+)?hour\b/i);
  if (half) return 30;
  const mins = message.match(
    /\bfor\s+(?:about\s+|around\s+)?(\d+)\s*(?:minutes?|mins?)\b/i
  );
  if (mins?.[1]) return parseInt(mins[1], 10);
  return undefined;
}

export function collectScheduleWindows(
  items: Item[],
  weekDates: string[],
  nowIso: string,
  tz: string,
  opts?: { ignoreItemIds?: Set<string> }
): { busy: TimeInterval[]; preferred: TimeInterval[] } {
  const nowDt = DateTime.fromISO(nowIso, { zone: tz });
  const ignore = opts?.ignoreItemIds ?? new Set<string>();
  const filtered = items.filter((i) => !ignore.has(i.id));
  const occurrences = expandWeek(filtered, weekDates, nowDt);

  const preferred: TimeInterval[] = [];
  const busy: TimeInterval[] = [];

  for (const occ of occurrences) {
    const item = filtered.find((i) => i.id === occ.itemId);
    const startMin = minutesIntoDay(occ.start, tz);
    const endMin = minutesIntoDay(occ.end, tz);
    if (!(endMin > startMin)) continue;
    const interval: TimeInterval = {
      date: occ.date,
      startMin,
      endMin,
      title: occ.title,
    };
    if (item?.schedulingRole === "study_period") {
      preferred.push(interval);
      continue;
    }
    busy.push(interval);
  }

  return { busy, preferred };
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const byDate = new Map<string, TimeInterval[]>();
  for (const iv of intervals) {
    const list = byDate.get(iv.date) ?? [];
    list.push(iv);
    byDate.set(iv.date, list);
  }
  const out: TimeInterval[] = [];
  for (const [date, list] of byDate) {
    list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    let cur: TimeInterval | null = null;
    for (const iv of list) {
      if (!cur || iv.startMin > cur.endMin) {
        if (cur) out.push(cur);
        cur = { date, startMin: iv.startMin, endMin: iv.endMin };
      } else {
        cur.endMin = Math.max(cur.endMin, iv.endMin);
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function freeGapsOnDate(
  date: string,
  busy: TimeInterval[],
  dayStartMin: number,
  dayEndMin: number,
  notBeforeMin?: number
): TimeInterval[] {
  const merged = mergeIntervals(busy.filter((b) => b.date === date));
  const startFloor = Math.max(dayStartMin, notBeforeMin ?? dayStartMin);
  if (startFloor >= dayEndMin) return [];

  const gaps: TimeInterval[] = [];
  let cursor = startFloor;
  for (const block of merged) {
    if (block.endMin <= cursor) continue;
    if (block.startMin > cursor) {
      gaps.push({ date, startMin: cursor, endMin: Math.min(block.startMin, dayEndMin) });
    }
    cursor = Math.max(cursor, block.endMin);
    if (cursor >= dayEndMin) break;
  }
  if (cursor < dayEndMin) {
    gaps.push({ date, startMin: cursor, endMin: dayEndMin });
  }
  return gaps.filter((g) => g.endMin - g.startMin > 0);
}

export function intervalsOverlapSlot(
  busy: TimeInterval[],
  date: string,
  timeStart: string,
  timeEnd: string
): boolean {
  const startMin =
    DateTime.fromFormat(timeStart, TIME_OF_DAY).hour * 60 +
    DateTime.fromFormat(timeStart, TIME_OF_DAY).minute;
  const endMin =
    DateTime.fromFormat(timeEnd, TIME_OF_DAY).hour * 60 +
    DateTime.fromFormat(timeEnd, TIME_OF_DAY).minute;
  if (!(endMin > startMin)) return true;
  return busy.some(
    (b) => b.date === date && overlaps(startMin, endMin, b.startMin, b.endMin)
  );
}

export type FindFreeSlotOptions = {
  dates: string[];
  busy: TimeInterval[];
  /** Study-period windows — tried first when they fit. */
  preferred?: TimeInterval[];
  durationMin: number;
  dayStartMin?: number;
  dayEndMin?: number;
  /** Earliest start on a given date (e.g. "now" for today). */
  notBeforeMinByDate?: Record<string, number>;
  /**
   * Prefer gaps that start at/after this minute-of-day (e.g. 15:00 for
   * after-school study). Falls back to earlier gaps if nothing fits.
   */
  preferAfterMin?: number;
};

/**
 * Next free slot of `durationMin` across the given dates (in order).
 * Prefers study-period windows, then any gap in working hours.
 */
export function findNextFreeSlot(opts: FindFreeSlotOptions): FreeSlot | null {
  const duration = Math.max(1, Math.round(opts.durationMin));
  const dayStart =
    opts.dayStartMin ?? DEFAULT_WORKING_HOURS.startHour * 60;
  const dayEnd = opts.dayEndMin ?? DEFAULT_WORKING_HOURS.endHour * 60;
  const preferred = opts.preferred ?? [];

  // 1) Prefer fitting inside a study period (minus any other busy overlap).
  for (const date of opts.dates) {
    const notBefore = opts.notBeforeMinByDate?.[date];
    const dayPreferred = preferred
      .filter((p) => p.date === date)
      .sort((a, b) => a.startMin - b.startMin);
    for (const window of dayPreferred) {
      const winStart = Math.max(window.startMin, notBefore ?? window.startMin);
      if (winStart + duration <= window.endMin) {
        const candidateStart = winStart;
        const candidateEnd = candidateStart + duration;
        if (
          !intervalsOverlapSlot(
            opts.busy,
            date,
            minToHhmm(candidateStart),
            minToHhmm(candidateEnd)
          )
        ) {
          return {
            date,
            timeStart: minToHhmm(candidateStart),
            timeEnd: minToHhmm(candidateEnd),
          };
        }
      }
    }
  }

  const tryGaps = (minStart: number): FreeSlot | null => {
    for (const date of opts.dates) {
      const floor = Math.max(
        dayStart,
        minStart,
        opts.notBeforeMinByDate?.[date] ?? dayStart
      );
      const gaps = freeGapsOnDate(date, opts.busy, floor, dayEnd);
      for (const gap of gaps) {
        if (gap.endMin - gap.startMin >= duration) {
          return {
            date,
            timeStart: minToHhmm(gap.startMin),
            timeEnd: minToHhmm(gap.startMin + duration),
          };
        }
      }
    }
    return null;
  };

  // 2) Prefer afternoon/evening when requested (typical for homework).
  if (opts.preferAfterMin != null) {
    const afternoon = tryGaps(opts.preferAfterMin);
    if (afternoon) return afternoon;
  }

  // 3) Any free gap in working hours.
  return tryGaps(dayStart);
}

/** Human-readable free gaps for the AI system prompt (compact). */
export function summarizeFreeSlots(
  dates: string[],
  busy: TimeInterval[],
  opts?: {
    dayStartMin?: number;
    dayEndMin?: number;
    notBeforeMinByDate?: Record<string, number>;
    maxPerDay?: number;
  }
): string {
  const dayStart = opts?.dayStartMin ?? DEFAULT_WORKING_HOURS.startHour * 60;
  const dayEnd = opts?.dayEndMin ?? DEFAULT_WORKING_HOURS.endHour * 60;
  const maxPerDay = opts?.maxPerDay ?? 4;
  const lines: string[] = [];

  for (const date of dates) {
    const gaps = freeGapsOnDate(
      date,
      busy,
      dayStart,
      dayEnd,
      opts?.notBeforeMinByDate?.[date]
    ).filter((g) => g.endMin - g.startMin >= 30);
    if (gaps.length === 0) {
      lines.push(`- ${date}: (no free gaps ≥30m in working hours)`);
      continue;
    }
    const shown = gaps.slice(0, maxPerDay).map((g) => {
      const mins = g.endMin - g.startMin;
      return `${minToHhmm(g.startMin)}-${minToHhmm(g.endMin)} (${mins}m)`;
    });
    const more = gaps.length > maxPerDay ? ` +${gaps.length - maxPerDay} more` : "";
    lines.push(`- ${date}: ${shown.join(", ")}${more}`);
  }

  return lines.join("\n");
}

export function notBeforeMapForNow(
  todayIso: string,
  nowIso: string,
  tz: string
): Record<string, number> {
  const nowDt = DateTime.fromISO(nowIso, { zone: tz });
  if (!nowDt.isValid || nowDt.toFormat(ISO_DATE) !== todayIso) return {};
  // Round up to next 5 minutes so we don't schedule into the immediate past.
  const raw = nowDt.hour * 60 + nowDt.minute;
  return { [todayIso]: Math.ceil(raw / 5) * 5 };
}
