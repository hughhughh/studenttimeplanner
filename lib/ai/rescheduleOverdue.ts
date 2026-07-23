import { DateTime } from "luxon";
import type { Item } from "@/lib/types";
import {
  createManyItems,
  listItems,
  updateItem as dbUpdateItem,
} from "@/lib/db/items";
import { dateTimeFrom, ISO_DATE, TIME_OF_DAY } from "@/lib/calendar/time";
import {
  collectScheduleWindows,
  findNextFreeSlot,
  notBeforeMapForNow,
  type TimeInterval,
} from "@/lib/scheduling/freeSlots";
import {
  snapshotFields,
  type UndoSnapshot,
  type UndoStep,
} from "@/lib/ai/undo";
import type { ApplyResult } from "@/lib/ai/apply";
import type { ItemCreateInput } from "@/lib/validation/item";

export type OverdueTarget = {
  itemId: string;
  /** Occurrence date the overdue block was on. */
  date: string;
};

type Planned =
  | { kind: "update"; id: string; patch: Record<string, unknown>; title: string }
  | {
      kind: "split";
      /** Skip the overdue occurrence on the series. */
      id: string;
      patch: Record<string, unknown>;
      /** New one-off catch-up task. */
      create: ItemCreateInput;
      title: string;
    };

/**
 * Deterministic overdue catch-up: move each incomplete overdue task into the
 * next free slot (preferring study periods). Does not call Gemini.
 */
export async function rescheduleOverdueTasks(
  userId: string,
  targets: OverdueTarget[],
  ctx: {
    tz: string;
    todayIso: string;
    weekDates: string[];
    nowIso: string;
  }
): Promise<ApplyResult> {
  if (targets.length === 0) {
    return { ok: true, clarification: "Nothing overdue to reschedule." };
  }

  const items = await listItems(userId);
  const byId = new Map(items.map((i) => [i.id, i]));

  const searchDates = buildSearchDates(ctx.todayIso, ctx.weekDates, ctx.tz, 10);
  const notBeforeMinByDate = notBeforeMapForNow(
    ctx.todayIso,
    ctx.nowIso,
    ctx.tz
  );

  const planned: Planned[] = [];
  const occupiedExtra: TimeInterval[] = [];
  const errors: string[] = [];

  for (const target of targets) {
    const item = byId.get(target.itemId);
    if (!item) {
      errors.push("An overdue item is no longer on the calendar.");
      continue;
    }
    if (item.type !== "task") {
      errors.push(
        `"${item.title}" is an activity and can't be rescheduled this way.`
      );
      continue;
    }

    const durationMin = occurrenceDurationMin(item, target.date, ctx.tz);
    if (!durationMin) {
      errors.push(`Couldn't read the duration for "${item.title}".`);
      continue;
    }

    const ignore = new Set<string>([
      item.id,
      ...planned.map((p) => p.id),
    ]);
    const { busy, preferred } = collectScheduleWindows(
      items,
      searchDates,
      ctx.nowIso,
      ctx.tz,
      { ignoreItemIds: ignore }
    );

    const slot = findNextFreeSlot({
      dates: searchDates,
      busy: [...busy, ...occupiedExtra],
      preferred,
      durationMin,
      notBeforeMinByDate,
      preferAfterMin: 15 * 60,
    });

    if (!slot) {
      errors.push(
        `No free slot found soon for "${item.title}" (${durationMin} min).`
      );
      continue;
    }

    planned.push(buildPlan(item, target.date, slot, ctx.tz));
    occupiedExtra.push({
      date: slot.date,
      startMin: hhmmToMin(slot.timeStart),
      endMin: hhmmToMin(slot.timeEnd),
      title: item.title,
    });
  }

  if (errors.length > 0 && planned.length === 0) {
    return { ok: false, error: errors[0] };
  }

  const undoSteps: UndoStep[] = [];

  const creates = planned.filter(
    (p): p is Extract<Planned, { kind: "split" }> => p.kind === "split"
  );
  if (creates.length > 0) {
    const created = await createManyItems(
      userId,
      creates.map((c) => c.create)
    );
    for (const item of created) {
      undoSteps.push({ kind: "delete", id: item.id });
    }
  }

  for (const step of planned) {
    const item = byId.get(step.id);
    if (item) {
      undoSteps.push({
        kind: "restore",
        id: step.id,
        patch: snapshotFields(item, step.patch),
      });
    }
    await dbUpdateItem(userId, step.id, step.patch);
  }

  const summaryParts = [
    planned.length === 1
      ? `Rescheduled “${planned[0]!.title}” to the next free slot.`
      : `Rescheduled ${planned.length} overdue tasks to the next free slots.`,
  ];
  if (errors.length > 0) {
    summaryParts.push(errors[0]!);
  }

  const undo: UndoSnapshot | undefined =
    undoSteps.length > 0
      ? { label: "reschedule overdue", steps: undoSteps }
      : undefined;

  return {
    ok: true,
    summary: summaryParts.join(" "),
    applied: planned.length,
    undo,
  };
}

function hhmmToMin(hhmm: string): number {
  const dt = DateTime.fromFormat(hhmm, TIME_OF_DAY);
  return dt.hour * 60 + dt.minute;
}

function buildSearchDates(
  todayIso: string,
  weekDates: string[],
  tz: string,
  extraDays: number
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (d: string) => {
    if (d < todayIso) return;
    if (seen.has(d)) return;
    seen.add(d);
    out.push(d);
  };
  for (const d of weekDates) push(d);
  let cur = DateTime.fromFormat(todayIso, ISO_DATE, { zone: tz });
  for (let i = 0; i < extraDays; i++) {
    push(cur.toFormat(ISO_DATE));
    cur = cur.plus({ days: 1 });
  }
  return out;
}

function occurrenceDurationMin(
  item: Item,
  date: string,
  tz: string
): number | null {
  if (item.recurrence) {
    const start =
      item.overrides?.[date]?.timeStart ?? item.recurrence.timeStart;
    const end = item.overrides?.[date]?.timeEnd ?? item.recurrence.timeEnd;
    const s = DateTime.fromFormat(start, TIME_OF_DAY);
    const e = DateTime.fromFormat(end, TIME_OF_DAY);
    if (!s.isValid || !e.isValid) return null;
    const mins = e.diff(s, "minutes").minutes;
    return mins > 0 ? mins : null;
  }
  const segments = item.segments ?? [];
  const match =
    segments.find(
      (seg) =>
        DateTime.fromISO(seg.start, { zone: tz }).toFormat(ISO_DATE) === date
    ) ?? segments[0];
  if (!match) return null;
  const s = DateTime.fromISO(match.start, { zone: tz });
  const e = DateTime.fromISO(match.end, { zone: tz });
  if (!s.isValid || !e.isValid) return null;
  const mins = e.diff(s, "minutes").minutes;
  return mins > 0 ? mins : null;
}

function buildPlan(
  item: Item,
  originDate: string,
  slot: { date: string; timeStart: string; timeEnd: string },
  tz: string
): Planned {
  if (!item.recurrence) {
    const segments = [...(item.segments ?? [])];
    let index = 0;
    const found = segments.findIndex(
      (s) =>
        DateTime.fromISO(s.start, { zone: tz }).toFormat(ISO_DATE) ===
        originDate
    );
    if (found !== -1) index = found;
    const startIso = dateTimeFrom(slot.date, slot.timeStart, tz).toISO();
    const endIso = dateTimeFrom(slot.date, slot.timeEnd, tz).toISO();
    if (!startIso || !endIso) {
      throw new Error("Invalid reschedule datetime.");
    }
    if (segments.length === 0) {
      return {
        kind: "update",
        id: item.id,
        title: item.title,
        patch: { segments: [{ start: startIso, end: endIso }] },
      };
    }
    segments[index] = { start: startIso, end: endIso };
    return {
      kind: "update",
      id: item.id,
      title: item.title,
      patch: { segments },
    };
  }

  if (slot.date === originDate) {
    return {
      kind: "update",
      id: item.id,
      title: item.title,
      patch: {
        overrides: {
          ...(item.overrides ?? {}),
          [originDate]: {
            ...(item.overrides?.[originDate] ?? {}),
            timeStart: slot.timeStart,
            timeEnd: slot.timeEnd,
            completed: false,
            completedAt: null,
          },
        },
      },
    };
  }

  // Recurring series can't jump to an arbitrary weekday via override alone.
  // Skip the overdue occurrence and create a one-off catch-up task.
  const startIso = dateTimeFrom(slot.date, slot.timeStart, tz).toISO();
  const endIso = dateTimeFrom(slot.date, slot.timeEnd, tz).toISO();
  if (!startIso || !endIso) {
    throw new Error("Invalid reschedule datetime.");
  }
  const create: ItemCreateInput = {
    type: item.type,
    title: item.title,
    color: item.color,
    movable: item.movable,
    notes: item.notes,
    tz: item.tz,
    segments: [{ start: startIso, end: endIso }],
    completed: false,
    completedAt: null,
  };
  return {
    kind: "split",
    id: item.id,
    title: item.title,
    patch: {
      exceptions: Array.from(
        new Set([...(item.exceptions ?? []), originDate])
      ),
    },
    create,
  };
}
