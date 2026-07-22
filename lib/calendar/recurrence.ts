import { DateTime } from "luxon";
import type { Item, Occurrence, OccurrenceStatus } from "@/lib/types";
import { dateOfISO, dateTimeFrom, ISO_DATE } from "@/lib/calendar/time";

/**
 * Expansion turns stored items (single or recurring) into the concrete
 * `Occurrence` blocks the week grid renders, applying exceptions and
 * per-occurrence overrides. This is where "skip one week" stays clean: a
 * skipped date is simply absent from the output, with no orphan documents.
 */

function computeStatus(
  type: Item["type"],
  completed: boolean,
  endIso: string,
  nowDt: DateTime
): OccurrenceStatus {
  if (type !== "task") return "upcoming";
  if (completed) return "done";
  return DateTime.fromISO(endIso) < nowDt ? "overdue" : "upcoming";
}

function expandSingle(
  item: Item,
  weekDateSet: Set<string>,
  nowDt: DateTime
): Occurrence[] {
  const out: Occurrence[] = [];
  const segments = item.segments ?? [];
  segments.forEach((seg, index) => {
    const date = dateOfISO(seg.start, item.tz);
    if (!weekDateSet.has(date)) return;
    const completed = Boolean(item.completed);
    out.push({
      itemId: item.id,
      key: segments.length > 1 ? `${item.id}#${index}` : item.id,
      type: item.type,
      title: item.title,
      color: item.color,
      movable: item.movable,
      notes: item.notes,
      recurring: false,
      date,
      start: seg.start,
      end: seg.end,
      segmentIndex: segments.length > 1 ? index : undefined,
      completable: item.type === "task",
      completed,
      status: computeStatus(item.type, completed, seg.end, nowDt),
    });
  });
  return out;
}

function expandRecurring(
  item: Item,
  weekDateList: string[],
  nowDt: DateTime
): Occurrence[] {
  const rec = item.recurrence;
  if (!rec) return [];

  const out: Occurrence[] = [];
  const exceptions = new Set(item.exceptions ?? []);
  const byWeekday = new Set<number>(rec.byWeekday);

  for (const date of weekDateList) {
    if (exceptions.has(date)) continue;
    if (date < rec.startDate) continue;
    if (rec.endDate && date > rec.endDate) continue;

    const dt = DateTime.fromFormat(date, ISO_DATE, { zone: item.tz });
    const weekday = dt.weekday;

    if (rec.freq === "weekly" && !byWeekday.has(weekday)) continue;
    if (rec.freq === "daily" && byWeekday.size > 0 && !byWeekday.has(weekday)) {
      continue;
    }

    const interval = rec.interval ?? 1;
    if (interval > 1) {
      const startWeek = DateTime.fromFormat(rec.startDate, ISO_DATE, {
        zone: item.tz,
      }).startOf("week");
      const dateWeek = dt.startOf("week");
      const weeksSinceStart = Math.floor(
        dateWeek.diff(startWeek, "weeks").weeks
      );
      if (weeksSinceStart < 0 || weeksSinceStart % interval !== 0) continue;
    }

    const override = item.overrides?.[date];
    const timeStart = override?.timeStart ?? rec.timeStart;
    const timeEnd = override?.timeEnd ?? rec.timeEnd;
    const start = dateTimeFrom(date, timeStart, item.tz);
    const end = dateTimeFrom(date, timeEnd, item.tz);
    const completed = Boolean(override?.completed);

    out.push({
      itemId: item.id,
      key: `${item.id}@${date}`,
      type: item.type,
      title: override?.title ?? item.title,
      color: override?.color ?? item.color,
      movable: item.movable,
      notes: override?.notes ?? item.notes,
      recurring: true,
      date,
      start: start.toISO() ?? "",
      end: end.toISO() ?? "",
      completable: item.type === "task",
      completed,
      status: computeStatus(item.type, completed, end.toISO() ?? "", nowDt),
    });
  }
  return out;
}

export function expandItem(
  item: Item,
  weekDateList: string[],
  nowDt: DateTime
): Occurrence[] {
  if (item.recurrence) return expandRecurring(item, weekDateList, nowDt);
  return expandSingle(item, new Set(weekDateList), nowDt);
}

/** Expand many items into a flat, time-sorted list of occurrences for a week. */
export function expandWeek(
  items: Item[],
  weekDateList: string[],
  nowDt: DateTime
): Occurrence[] {
  const occurrences = items.flatMap((item) =>
    expandItem(item, weekDateList, nowDt)
  );
  occurrences.sort((a, b) => a.start.localeCompare(b.start));
  return occurrences;
}
